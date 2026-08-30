import { factories } from '@strapi/strapi';
import {
  computeProgress,
  nextLessonId,
} from '../../lesson-completion/services/progress';

const UID = 'api::enrollment.enrollment';

type WithCourse = { course?: { id: number } | null };

/** In-progress first, then not-started, then complete. Mirrors the dashboard. */
const resumeRank = (percent: number) =>
  percent > 0 && percent < 100 ? 0 : percent === 0 ? 1 : 2;

const pushInto = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
};

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

    // Only a `published` course is open for self-enrolment (D-039). `draft` and
    // `enrolled_only` are 404 here — the same answer a non-existent id gets, so
    // an unlisted course can't be confirmed to exist. A manager can still
    // pre-load a roster via POST /courses/:id/enrollments.
    if (course.status !== 'published') {
      return ctx.notFound('No such course');
    }

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
      where: { course: { id: { $in: courseIds } }, published: { $ne: false } },
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

  /**
   * GET /api/enrollments/me/dashboard — everything the student dashboard needs
   * in one response: enrolments with derived progress, quiz attempts, and the
   * "resume" card (top-ranked course + its next lesson title). Four flat DB
   * queries, all joins done in memory — no query in a loop.
   */
  async dashboard(ctx) {
    const userId = ctx.state.user.id;

    const [enrollments, attempts] = (await Promise.all([
      strapi.db.query(UID).findMany({
        where: { student: { id: userId } },
        populate: {
          course: { select: ['id', 'documentId', 'title', 'slug'] },
        },
        orderBy: { enrolledAt: 'desc' },
      }),
      strapi.db.query('api::quiz-attempt.quiz-attempt').findMany({
        where: { student: { id: userId } },
        select: ['id', 'documentId', 'score', 'totalQuestions', 'submittedAt', 'answers'],
        populate: {
          quiz: {
            select: ['id', 'documentId', 'title'],
            populate: { course: { select: ['documentId', 'title'] } },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
    ])) as [
      Array<{
        enrolledAt: string;
        course?: {
          id: number;
          documentId: string;
          title: string;
          slug: string | null;
        } | null;
      }>,
      Array<{
        documentId: string;
        score: number;
        totalQuestions: number;
        submittedAt: string;
        answers: unknown;
        quiz?: {
          documentId: string;
          title: string;
          course?: { documentId: string; title: string } | null;
        } | null;
      }>,
    ];

    const courseIds = enrollments
      .map((e) => e.course?.id)
      .filter((id): id is number => typeof id === 'number');

    const [lessons, completions] = courseIds.length
      ? ((await Promise.all([
          strapi.db.query('api::lesson.lesson').findMany({
            where: {
              course: { id: { $in: courseIds } },
              published: { $ne: false },
            },
            select: ['id', 'documentId', 'title', 'order'],
            populate: { course: { select: ['id'] } },
          }),
          strapi.db.query('api::lesson-completion.lesson-completion').findMany({
            where: {
              student: { id: userId },
              course: { id: { $in: courseIds } },
            },
            select: ['id'],
            populate: {
              lesson: { select: ['id', 'documentId'] },
              course: { select: ['id'] },
            },
          }),
        ])) as [
          Array<{
            id: number;
            documentId: string;
            title: string;
            order: number;
            course?: { id: number } | null;
          }>,
          Array<{
            lesson?: { id: number; documentId: string } | null;
            course?: { id: number } | null;
          }>,
        ])
      : [[], []];

    const lessonsByCourse = new Map<
      number,
      Array<{ id: number; documentId: string; title: string; order: number }>
    >();
    for (const l of lessons) {
      if (l.course) {
        pushInto(lessonsByCourse, l.course.id, {
          id: l.id,
          documentId: l.documentId,
          title: l.title,
          order: l.order,
        });
      }
    }

    const doneIdsByCourse = new Map<number, number[]>();
    const doneDocIdsByCourse = new Map<number, string[]>();
    for (const c of completions) {
      if (!c.course || !c.lesson) continue;
      pushInto(doneIdsByCourse, c.course.id, c.lesson.id);
      pushInto(doneDocIdsByCourse, c.course.id, c.lesson.documentId);
    }

    const enrolShaped = enrollments
      .filter(
        (e): e is typeof e & { course: NonNullable<(typeof e)['course']> } =>
          Boolean(e.course),
      )
      .map((e) => ({
        numericId: e.course.id,
        enrolledAt: e.enrolledAt,
        course: {
          id: e.course.documentId,
          title: e.course.title,
          slug: e.course.slug,
        },
        progress: computeProgress(
          (lessonsByCourse.get(e.course.id) ?? []).map((l) => l.id),
          doneIdsByCourse.get(e.course.id) ?? [],
        ),
      }));

    const top = [...enrolShaped].sort(
      (a, b) => resumeRank(a.progress.percent) - resumeRank(b.progress.percent),
    )[0];

    let resume: {
      course: { id: string; title: string; slug: string | null };
      progress: ReturnType<typeof computeProgress>;
      nextLessonTitle: string | null;
    } | null = null;

    if (top) {
      const courseLessons = lessonsByCourse.get(top.numericId) ?? [];
      const doneDocIds = doneDocIdsByCourse.get(top.numericId) ?? [];
      const nextId =
        top.progress.total > 0
          ? nextLessonId(
              courseLessons.map((l) => ({ id: l.documentId, order: l.order })),
              doneDocIds,
            )
          : null;
      const next =
        courseLessons.find((l) => l.documentId === nextId) ??
        courseLessons.find((l) => !doneDocIds.includes(l.documentId)) ??
        null;
      resume = {
        course: top.course,
        progress: top.progress,
        nextLessonTitle: next?.title ?? null,
      };
    }

    ctx.body = {
      data: {
        enrollments: enrolShaped.map(({ numericId: _numericId, ...e }) => e),
        attempts: attempts.map((r) => ({
          id: r.documentId,
          score: r.score,
          totalQuestions: r.totalQuestions,
          submittedAt: r.submittedAt,
          answers: Array.isArray(r.answers) ? r.answers : [],
          quiz: r.quiz
            ? {
                id: r.quiz.documentId,
                title: r.quiz.title,
                course: r.quiz.course
                  ? { id: r.quiz.course.documentId, title: r.quiz.course.title }
                  : null,
              }
            : null,
        })),
        resume,
      },
    };
  },
}));
