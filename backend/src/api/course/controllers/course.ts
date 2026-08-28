import { factories } from '@strapi/strapi';
import {
  computeProgress,
  computeProgressForCourse,
  nextLessonId,
} from '../../lesson-completion/services/progress';

const UID = 'api::course.course';
const MANAGER_ROLES = ['admin', 'content-manager', 'instructor'];

type CoreHelpers = {
  sanitizeQuery(ctx: unknown): Promise<Record<string, unknown>>;
  sanitizeOutput(data: unknown, ctx: unknown): Promise<unknown>;
  transformResponse(data: unknown, meta?: unknown): unknown;
};

type CourseRow = {
  documentId: string;
  title: string;
  slug: string | null;
  description: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  instructor?: { fullName: string | null } | null;
  lessons?: Array<{ title: string; order: number }>;
};

/**
 * Explicit output shape. `sanitizeOutput` would strip `instructor` and `lessons`
 * for any caller without a read grant on those types — so instead we hand-pick
 * exactly the safe fields (D-004 discipline: the shape can only contain what it
 * names). Lesson `content` has no way in here.
 */
const shapeCourse = (c: CourseRow) => ({
  documentId: c.documentId,
  title: c.title,
  slug: c.slug,
  description: c.description ?? null,
  coverImageUrl: c.coverImageUrl ?? null,
  createdAt: c.createdAt,
  instructor: c.instructor ? { fullName: c.instructor.fullName ?? null } : null,
  lessons: (c.lessons ?? [])
    .map((l) => ({ title: l.title, order: l.order }))
    .sort((a, b) => a.order - b.order),
});

const SAFE_POPULATE = {
  instructor: { fields: ['fullName'] },
  lessons: { fields: ['title', 'order'], sort: ['order:asc'] },
};

/**
 * Course controller.
 *
 * - find / findOne: server-controlled population + explicit output shape, so a
 *   student can never pull lesson `content` through a course query
 *   (CVE-2026-27886 is this class). The public catalogue also hides courses
 *   with zero lessons — forced filter, applied last.
 * - create: an instructor's course is forced to instructor = ctx.state.user.id.
 *   A body-supplied `instructor` is ignored.
 * - delete: refuses with 409 while enrollments exist (D-020).
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const self = this as unknown as CoreHelpers;
    const isManager = MANAGER_ROLES.includes(ctx.state.user?.role?.type ?? '');
    const sanitized = await self.sanitizeQuery(ctx);

    const filters = isManager
      ? sanitized.filters
      : {
          ...((sanitized.filters as Record<string, unknown>) ?? {}),
          lessons: { id: { $notNull: true } }, // forced last
        };

    const { results, pagination } = await strapi.service(UID).find({
      ...sanitized,
      filters,
      fields: ['title', 'slug', 'description', 'coverImageUrl', 'createdAt'],
      populate: SAFE_POPULATE,
    });

    return self.transformResponse((results as CourseRow[]).map(shapeCourse), {
      pagination,
    });
  },

  async findOne(ctx) {
    const self = this as unknown as CoreHelpers;
    const entity = (await strapi.service(UID).findOne(ctx.params.id, {
      fields: ['title', 'slug', 'description', 'coverImageUrl', 'createdAt'],
      populate: SAFE_POPULATE,
    })) as CourseRow | null;

    if (!entity) return ctx.notFound();
    return self.transformResponse(shapeCourse(entity));
  },

  async create(ctx) {
    const self = this as unknown as CoreHelpers;
    const role = ctx.state.user?.role?.type;
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

    // Owner is decided here, never read raw from the body. Strapi 5.52 also
    // refuses a `user` relation in content-API input ("Invalid key instructor"),
    // so the course is written through the document service instead.
    let instructorId: number | undefined;
    if (role === 'instructor') {
      instructorId = ctx.state.user.id; // forced to self
    } else if (role === 'admin' || role === 'content-manager') {
      const raw = body.instructor;
      instructorId =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number(raw) || undefined
            : undefined;
    }

    // Explicit field allowlist — a course create only ever accepts these.
    const data: {
      title?: string;
      description?: string;
      coverImageUrl?: string;
      slug?: string;
      instructor?: number;
    } = {};
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.description === 'string') data.description = body.description;
    if (typeof body.coverImageUrl === 'string')
      data.coverImageUrl = body.coverImageUrl;
    if (instructorId) data.instructor = instructorId;

    // The uid lifecycle doesn't fire through the document service, so derive the
    // slug here: kebab-case the title + a short suffix for uniqueness.
    const slugBase =
      typeof body.slug === 'string' && body.slug ? body.slug : (data.title ?? 'course');
    data.slug = `${slugBase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`;

    const entity = (await strapi.documents(UID).create({
      // @ts-expect-error Input type rejects a bare relation id; the explicit
      // field allowlist above is the real guard.
      data,
      status: 'published',
    })) as CourseRow;

    await strapi.service('api::audit-log.audit-log').record({
      action: 'course.created',
      category: 'content',
      ctx,
      target: { type: 'course', id: entity.documentId, label: entity.title },
      metadata: { title: entity.title },
    });

    return self.transformResponse(shapeCourse(entity));
  },

  async delete(ctx) {
    const course = await strapi.db
      .query(UID)
      .findOne({ where: { documentId: ctx.params.id } });
    if (!course) return ctx.notFound();

    const enrolled = await strapi.db
      .query('api::enrollment.enrollment')
      .count({ where: { course: { id: course.id } } });

    if (enrolled > 0) {
      ctx.status = 409;
      ctx.body = {
        error: {
          status: 409,
          name: 'ConflictError',
          message: `Cannot delete "${course.title}" — ${enrolled} student${
            enrolled === 1 ? ' is' : 's are'
          } enrolled.`,
          details: { dependents: enrolled },
        },
      };
      return;
    }

    const result = await super.delete(ctx);

    await strapi.service('api::audit-log.audit-log').record({
      action: 'course.deleted',
      category: 'content',
      ctx,
      target: { type: 'course', id: course.documentId, label: course.title },
      metadata: { title: course.title },
    });

    return result;
  },

  /**
   * GET /api/courses/:id/learn — the whole learning context in one round trip
   * for an enrolled student: the course, its ordered lessons (with content —
   * this is the one place a student legitimately gets it), which are done, the
   * derived progress, and the next lesson. Two queries: lessons, completions.
   */
  async learn(ctx) {
    const userId = ctx.state.user.id;

    const course = await strapi.db.query(UID).findOne({
      where: { documentId: ctx.params.id },
    });
    if (!course) return ctx.notFound();

    const enrolled = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: { dedupeKey: `${userId}:${course.id}` },
    });
    if (!enrolled) return ctx.forbidden('You are not enrolled in this course');

    const lessons = (await strapi.db.query('api::lesson.lesson').findMany({
      where: { course: { id: course.id } },
      orderBy: { order: 'asc' },
    })) as Array<{
      id: number;
      documentId: string;
      title: string;
      order: number;
      content: string | null;
      videoUrl: string | null;
    }>;

    const completions = (await strapi.db
      .query('api::lesson-completion.lesson-completion')
      .findMany({
        where: { student: { id: userId }, course: { id: course.id } },
        populate: { lesson: true },
      })) as Array<{ lesson?: { id: number } | null }>;

    const doneIds = new Set(
      completions
        .map((c) => c.lesson?.id)
        .filter((id): id is number => typeof id === 'number'),
    );

    const quiz = (await strapi.db.query('api::quiz.quiz').findOne({
      where: { course: { id: course.id } },
      orderBy: { id: 'asc' },
    })) as { documentId: string } | null;

    const orderedForNext = lessons.map((l) => ({ id: l.documentId, order: l.order }));

    ctx.body = {
      data: {
        course: {
          id: course.documentId,
          title: course.title,
          slug: course.slug,
        },
        lessons: lessons.map((l) => ({
          id: l.documentId,
          title: l.title,
          order: l.order,
          content: l.content ?? '',
          videoUrl: l.videoUrl ?? '',
          completed: doneIds.has(l.id),
        })),
        progress: computeProgress(
          lessons.map((l) => l.id),
          [...doneIds],
        ),
        nextLessonId: nextLessonId(
          orderedForNext,
          lessons.filter((l) => doneIds.has(l.id)).map((l) => l.documentId),
        ),
        quizId: quiz?.documentId ?? null,
      },
    };
  },

  /**
   * GET /api/courses/:id/student-progress — admin / content-manager / owning
   * instructor. The batched query PERFORMANCE.md #1 is about: three flat
   * queries (roster, lesson ids, all completions), then O(n) in memory — not
   * computeProgress in a loop over students.
   */
  async studentProgress(ctx) {
    const course = await strapi.db.query(UID).findOne({
      where: { documentId: ctx.params.id },
    });
    if (!course) return ctx.notFound();

    const roster = (await strapi.db
      .query('api::enrollment.enrollment')
      .findMany({
        where: { course: { id: course.id } },
        populate: { student: true },
        orderBy: { enrolledAt: 'asc' },
      })) as Array<{
      enrolledAt: string;
      student?: { id: number; fullName: string | null; username: string } | null;
    }>;

    const lessons = (await strapi.db
      .query('api::lesson.lesson')
      .findMany({ where: { course: { id: course.id } } })) as Array<{ id: number }>;

    const completions = (await strapi.db
      .query('api::lesson-completion.lesson-completion')
      .findMany({
        where: { course: { id: course.id } },
        populate: { student: true, lesson: true },
      })) as Array<{
      completedAt: string;
      student?: { id: number } | null;
      lesson?: { id: number } | null;
    }>;

    const lessonIds = lessons.map((l) => l.id);
    const progressByStudent = computeProgressForCourse(
      lessonIds,
      completions
        .filter((c) => c.student && c.lesson)
        .map((c) => ({ studentId: c.student!.id, lessonId: c.lesson!.id })),
    );

    const lastActivityByStudent = new Map<number, string>();
    for (const c of completions) {
      if (!c.student) continue;
      const prev = lastActivityByStudent.get(c.student.id);
      if (!prev || c.completedAt > prev) {
        lastActivityByStudent.set(c.student.id, c.completedAt);
      }
    }

    const empty = { completed: 0, total: lessonIds.length, percent: 0 };
    const data = roster
      .filter((r) => r.student)
      .map((r) => ({
        student: {
          id: r.student!.id,
          name: r.student!.fullName ?? r.student!.username,
        },
        enrolledAt: r.enrolledAt,
        lastActivity: lastActivityByStudent.get(r.student!.id) ?? null,
        progress: progressByStudent.get(String(r.student!.id)) ?? empty,
      }))
      .sort((a, b) => a.progress.percent - b.progress.percent); // stuck first

    ctx.body = { data };
  },
}));
