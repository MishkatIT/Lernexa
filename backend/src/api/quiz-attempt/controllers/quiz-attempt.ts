import { factories } from '@strapi/strapi';

const UID = 'api::quiz-attempt.quiz-attempt';

/**
 * Quiz attempts — only GET /api/quiz-attempts/me exists. Forced student filter
 * (layer 4). No default CRUD routes.
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  async me(ctx) {
    const userId = ctx.state.user.id;

    const rows = (await strapi.db.query(UID).findMany({
      where: { student: { id: userId } }, // forced — never from the query string
      populate: { quiz: { populate: { course: true } } },
      orderBy: { submittedAt: 'desc' },
    })) as Array<{
      score: number;
      totalQuestions: number;
      submittedAt: string;
      quiz?: {
        documentId: string;
        title: string;
        course?: { documentId: string; title: string } | null;
      } | null;
    }>;

    ctx.body = {
      data: rows.map((r) => ({
        score: r.score,
        totalQuestions: r.totalQuestions,
        submittedAt: r.submittedAt,
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
    };
  },
}));
