import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';
import {
  toStudentQuiz,
  gradeQuiz,
  buildAttemptReview,
  type Quiz,
  type SubmittedAnswer,
} from '../services/grading';

const UID = 'api::quiz.quiz';

type CoreHelpers = {
  sanitizeQuery(ctx: unknown): Promise<Record<string, unknown>>;
  sanitizeOutput(data: unknown, ctx: unknown): Promise<unknown>;
  transformResponse(data: unknown, meta?: unknown): unknown;
};

/** Load a quiz with its questions + options + isCorrect, plus the course id. */
async function loadFullQuiz(strapi: Core.Strapi, documentId: string) {
  return (await strapi.db.query(UID).findOne({
    where: { documentId },
    populate: { questions: { populate: { options: true } }, course: true },
  })) as
    | (Quiz & { course?: { id: number } | null; documentId: string })
    | null;
}

/**
 * Quiz controller.
 *
 * find / findOne (the raw quiz, with isCorrect) are granted to managers only —
 * students have no grant and the endpoint simply doesn't answer them. Students
 * get `take` (sanitised) and `submit` (graded server-side).
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  /** GET /api/quizzes/:id/take — enrolled student. No isCorrect in the reply. */
  async take(ctx) {
    const userId = ctx.state.user.id;
    const quiz = await loadFullQuiz(strapi, ctx.params.id);
    if (!quiz?.course) return ctx.notFound();

    const enrolled = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: { dedupeKey: `${userId}:${quiz.course.id}` },
    });
    if (!enrolled) return ctx.forbidden('You are not enrolled in this course');

    // Top-level id is the documentId (the client submits to /quizzes/:id/submit).
    // Question and option ids stay numeric — components have no documentId.
    ctx.body = { data: { ...toStudentQuiz(quiz), id: quiz.documentId } };
  },

  /**
   * POST /api/quizzes/:id/submit — enrolled student. body:
   * { answers: [{ questionId, selectedOptionId }] }. Graded here from the full
   * quiz; the attempt stores the score and a totalQuestions snapshot.
   */
  async submit(ctx) {
    const userId = ctx.state.user.id;
    const quiz = await loadFullQuiz(strapi, ctx.params.id);
    if (!quiz?.course) return ctx.notFound();

    const enrolled = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: { dedupeKey: `${userId}:${quiz.course.id}` },
    });
    if (!enrolled) return ctx.forbidden('You are not enrolled in this course');

    const raw = ctx.request.body?.answers ?? ctx.request.body?.data?.answers;
    if (!Array.isArray(raw)) return ctx.badRequest('answers[] is required');

    const submission: SubmittedAnswer[] = raw
      .filter((a): a is { questionId: unknown; selectedOptionId?: unknown } =>
        Boolean(a && typeof a === 'object'),
      )
      .map((a) => ({
        questionId: a.questionId as number | string,
        selectedOptionId:
          (a.selectedOptionId as number | string | null | undefined) ?? null,
      }));

    const result = gradeQuiz(quiz, submission);

    // Store the reviewable snapshot, not the bare graded ids — a later view of
    // this attempt then needs no join back to the quiz (which may have changed).
    await strapi.db.query('api::quiz-attempt.quiz-attempt').create({
      data: {
        student: userId,
        quiz: quiz.id,
        score: result.score,
        totalQuestions: result.totalQuestions,
        answers: buildAttemptReview(quiz, result),
        submittedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    // correctness now legitimately exists client-side — the attempt is recorded.
    ctx.body = { data: result };
  },
}));
