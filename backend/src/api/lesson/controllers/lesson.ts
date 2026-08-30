import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

const UID = 'api::lesson.lesson';

/**
 * Lesson controller. Ownership is enforced by global::is-lesson-owner on the
 * routes (lesson → course → instructor). Here we only add the delete guard:
 * refuse with 409 while completions exist (D-020).
 */
type CoreHelpers = {
  sanitizeQuery(ctx: unknown): Promise<Record<string, unknown>>;
  sanitizeOutput(data: unknown, ctx: unknown): Promise<unknown>;
  transformResponse(data: unknown, meta?: unknown): unknown;
};

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * Layer 4 — an instructor listing lessons only ever sees lessons in their own
   * courses. The ownership filter is forced last so a client filter can't widen
   * it. admin / content-manager see everything; students and anonymous have no
   * `lesson.find` grant and never reach here.
   */
  async find(ctx) {
    const self = this as unknown as CoreHelpers;
    const sanitized = await self.sanitizeQuery(ctx);
    const type = ctx.state.user?.role?.type;

    // Composed with `$and`, not a shallow spread: the manage UI sends
    // `filters[course][documentId]` to list one course's lessons, and that
    // clause must survive alongside the forced owner scope rather than be
    // overwritten by it (mirrors course.find).
    const and: unknown[] = [];
    const base = (sanitized.filters as Record<string, unknown>) ?? {};
    if (Object.keys(base).length > 0) and.push(base);
    if (type === 'instructor') {
      and.push({ course: { instructor: { id: { $eq: ctx.state.user.id } } } });
    }
    const filters = and.length > 0 ? { $and: and } : {};

    const { results, pagination } = await strapi
      .service(UID)
      .find({ ...sanitized, filters });

    return self.transformResponse(await self.sanitizeOutput(results, ctx), {
      pagination,
    });
  },

  async delete(ctx) {
    const lesson = await strapi.db
      .query(UID)
      .findOne({ where: { documentId: ctx.params.id } });
    if (!lesson) return ctx.notFound();

    const completions = await strapi.db
      .query('api::lesson-completion.lesson-completion')
      .count({ where: { lesson: { id: lesson.id } } });

    if (completions > 0) {
      ctx.status = 409;
      ctx.body = {
        error: {
          status: 409,
          name: 'ConflictError',
          message: `Cannot delete "${lesson.title}" — ${completions} completion${
            completions === 1 ? '' : 's'
          } recorded.`,
          details: { dependents: completions },
        },
      };
      return;
    }

    return super.delete(ctx);
  },

  /**
   * POST /api/lessons/:id/publish — owner / manager (route-gated). An
   * unpublished lesson drops out of every student view: the catalogue's
   * non-empty check, /learn, progression gates and all progress denominators
   * (D-039). Recorded completions are kept, just not counted while hidden.
   */
  async publish(ctx) {
    return setLessonPublished(strapi, ctx, true);
  },
  async unpublish(ctx) {
    return setLessonPublished(strapi, ctx, false);
  },
}));

/** Flip a lesson's `published` flag and write one audit row. Route policies
 *  (has-role + is-lesson-owner) have already authorised the caller. */
async function setLessonPublished(
  strapi: Core.Strapi,
  ctx: any,
  next: boolean,
) {
  const lesson = await strapi.db
    .query(UID)
    .findOne({ where: { documentId: ctx.params.id } });
  if (!lesson) return ctx.notFound();

  if (lesson.published !== next) {
    await strapi.db
      .query(UID)
      .update({ where: { id: lesson.id }, data: { published: next } });
  }

  await strapi.service('api::audit-log.audit-log').record({
    action: next ? 'lesson.published' : 'lesson.unpublished',
    category: 'content',
    ctx,
    target: { type: 'lesson', id: lesson.documentId, label: lesson.title },
    metadata: { title: lesson.title },
  });

  ctx.body = { data: { documentId: lesson.documentId, published: next } };
}
