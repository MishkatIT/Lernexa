import { factories } from '@strapi/strapi';
import { computeProgress } from '../../lesson-completion/services/progress';

const UID = 'api::enrollment.enrollment';

type WithCourse = { course?: { id: number } | null };

/**
 * Enrollment — only two endpoints exist (POST /enrollments/enroll,
 * GET /enrollments/me). No default CRUD routes are generated. The student is
 * always ctx.state.user, never the body (RBAC invariant #1).
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  /** POST /api/enrollments/enroll — body { courseId }. Idempotent. */
  async enroll(ctx) {
    const userId = ctx.state.user.id;
    const courseId =
      ctx.request.body?.courseId ?? ctx.request.body?.data?.courseId;
    if (!courseId || typeof courseId !== 'string') {
      return ctx.badRequest('courseId is required');
    }

    const course = await strapi.db
      .query('api::course.course')
      .findOne({ where: { documentId: courseId } });
    if (!course) return ctx.notFound('No such course');

    const dedupeKey = `${userId}:${course.id}`;

    const existing = await strapi.db.query(UID).findOne({ where: { dedupeKey } });
    if (existing) {
      // Double-click / re-enrol is not an error — return the row we have.
      ctx.body = {
        data: { enrolledAt: existing.enrolledAt, alreadyEnrolled: true },
      };
      return;
    }

    const created = await strapi.db.query(UID).create({
      data: {
        student: userId,
        course: course.id,
        enrolledAt: new Date(),
        dedupeKey,
        publishedAt: new Date(),
      },
    });

    ctx.body = {
      data: { enrolledAt: created.enrolledAt, alreadyEnrolled: false },
    };
  },

  /**
   * GET /api/enrollments/me — the caller's enrolments with derived progress.
   * Three queries regardless of course count: enrolments, the lessons of those
   * courses, this student's completions. Progress is computed in memory, never
   * stored (D-003).
   */
  async me(ctx) {
    const userId = ctx.state.user.id;

    const enrollments = (await strapi.db.query(UID).findMany({
      where: { student: { id: userId } },
      populate: { course: true },
      orderBy: { enrolledAt: 'desc' },
    })) as Array<{
      enrolledAt: string;
      course?: {
        id: number;
        documentId: string;
        title: string;
        slug: string | null;
      } | null;
    }>;

    const courseIds = enrollments
      .map((e) => e.course?.id)
      .filter((id): id is number => typeof id === 'number');

    if (courseIds.length === 0) {
      ctx.body = { data: [] };
      return;
    }

    const lessons = (await strapi.db.query('api::lesson.lesson').findMany({
      where: { course: { id: { $in: courseIds } } },
      populate: { course: true },
    })) as Array<{ id: number } & WithCourse>;

    const completions = (await strapi.db
      .query('api::lesson-completion.lesson-completion')
      .findMany({
        where: { student: { id: userId }, course: { id: { $in: courseIds } } },
        populate: { lesson: true, course: true },
      })) as Array<{ lesson?: { id: number } | null } & WithCourse>;

    const lessonsByCourse = new Map<number, number[]>();
    for (const l of lessons) {
      if (!l.course) continue;
      const arr = lessonsByCourse.get(l.course.id) ?? [];
      arr.push(l.id);
      lessonsByCourse.set(l.course.id, arr);
    }

    const doneByCourse = new Map<number, number[]>();
    for (const c of completions) {
      if (!c.course || !c.lesson) continue;
      const arr = doneByCourse.get(c.course.id) ?? [];
      arr.push(c.lesson.id);
      doneByCourse.set(c.course.id, arr);
    }

    const data = enrollments
      .filter(
        (e): e is typeof e & { course: NonNullable<(typeof e)['course']> } =>
          Boolean(e.course),
      )
      .map((e) => ({
        enrolledAt: e.enrolledAt,
        course: {
          id: e.course.documentId,
          title: e.course.title,
          slug: e.course.slug,
        },
        progress: computeProgress(
          lessonsByCourse.get(e.course.id) ?? [],
          doneByCourse.get(e.course.id) ?? [],
        ),
      }));

    ctx.body = { data };
  },
}));
