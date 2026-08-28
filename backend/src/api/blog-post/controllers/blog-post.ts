import { factories } from '@strapi/strapi';

const UID = 'api::blog-post.blog-post';
const MANAGER_ROLES = ['admin', 'content-manager'];

type CoreHelpers = {
  sanitizeQuery(ctx: unknown): Promise<Record<string, unknown>>;
  sanitizeOutput(data: unknown, ctx: unknown): Promise<unknown>;
  transformResponse(data: unknown, meta?: unknown): unknown;
};

type BlogRow = {
  documentId: string;
  title: string;
  slug: string | null;
  body: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  author?: { fullName: string | null } | null;
};

const shape = (b: BlogRow) => ({
  documentId: b.documentId,
  title: b.title,
  slug: b.slug,
  body: b.body ?? null,
  coverImageUrl: b.coverImageUrl ?? null,
  publishedAt: b.publishedAt ?? null,
  author: b.author ? { fullName: b.author.fullName ?? null } : null,
});

/**
 * Blog.
 *
 * - find / findOne: a non-manager (public, student, instructor) is FORCED to
 *   published only — `status=draft` from the query string is ignored. Managers
 *   may pass `status=draft` to see drafts.
 * - create: `author` is forced to ctx.state.user.id (content API rejects a
 *   `user` relation in input, so it's written via the document service).
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const self = this as unknown as CoreHelpers;
    const isManager = MANAGER_ROLES.includes(ctx.state.user?.role?.type ?? '');
    const sanitized = await self.sanitizeQuery(ctx);

    const wantsDraft =
      isManager && String(ctx.query?.status ?? '') === 'draft';

    const rows = (await strapi.documents(UID).findMany({
      ...sanitized,
      status: (wantsDraft ? 'draft' : 'published') as 'draft' | 'published', // forced for non-managers
      fields: ['title', 'slug', 'coverImageUrl', 'publishedAt'],
      populate: { author: { fields: ['fullName'] } },
      sort: ['publishedAt:desc'],
    })) as unknown as BlogRow[];

    return self.transformResponse(rows.map(shape));
  },

  async findOne(ctx) {
    const self = this as unknown as CoreHelpers;
    const isManager = MANAGER_ROLES.includes(ctx.state.user?.role?.type ?? '');

    const entity = (await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      status: isManager ? undefined : 'published', // non-managers: published only
      fields: ['title', 'slug', 'body', 'coverImageUrl', 'publishedAt'],
      populate: { author: { fields: ['fullName'] } },
    })) as unknown as BlogRow | null;

    if (!entity) return ctx.notFound();
    return self.transformResponse(shape(entity));
  },

  async create(ctx) {
    const self = this as unknown as CoreHelpers;
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

    const data: {
      title?: string;
      body?: string;
      coverImageUrl?: string;
      slug?: string;
      author: number;
    } = { author: ctx.state.user.id }; // forced — never from the request
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.body === 'string') data.body = body.body;
    if (typeof body.coverImageUrl === 'string')
      data.coverImageUrl = body.coverImageUrl;

    const base =
      typeof body.slug === 'string' && body.slug
        ? body.slug
        : (data.title ?? 'post');
    data.slug = `${base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`;

    // Created as a draft (no publishedAt) — the editor publishes explicitly.
    const entity = (await strapi.documents(UID).create({
      // @ts-expect-error Input type rejects a bare relation id; author is forced above.
      data,
      status: 'draft',
    })) as unknown as BlogRow;

    return self.transformResponse(shape(entity));
  },

  /** POST /api/blog-posts/:id/publish */
  async publish(ctx) {
    const self = this as unknown as CoreHelpers;
    await strapi.documents(UID).publish({ documentId: ctx.params.id });
    const entity = (await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      status: 'published',
      fields: ['title', 'slug', 'body', 'coverImageUrl', 'publishedAt'],
      populate: { author: { fields: ['fullName'] } },
    })) as unknown as BlogRow | null;
    if (!entity) return ctx.notFound();
    return self.transformResponse(shape(entity));
  },

  /** POST /api/blog-posts/:id/unpublish */
  async unpublish(ctx) {
    const self = this as unknown as CoreHelpers;
    await strapi.documents(UID).unpublish({ documentId: ctx.params.id });
    return self.transformResponse({ documentId: ctx.params.id, publishedAt: null });
  },
}));
