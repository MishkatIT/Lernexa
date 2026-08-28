import type { Core } from '@strapi/strapi';
import type { PolicyContext } from './_policy-context';

/**
 * global::is-quiz-owner — ownership resolved through the quiz's course.
 *
 *   - PUT/DELETE /api/quizzes/:id → load the quiz, walk quiz → course →
 *     instructor.
 *   - POST /api/quizzes           → no quiz yet; the target course is in the
 *     body.
 *
 * admin / content-manager pass. Anyone else, or a mismatch → false → 403.
 */
export default async (
  policyContext: unknown,
  _config: unknown,
  { strapi }: { strapi: Core.Strapi },
): Promise<boolean> => {
  const ctx = policyContext as PolicyContext;
  const user = ctx.state.user;
  if (!user) return false;

  const type = user.role?.type;
  if (type === 'admin' || type === 'content-manager') return true;
  if (type !== 'instructor') return false;

  const documentId = ctx.params.id;
  let ownerId: number | undefined;

  if (documentId) {
    const quiz = await strapi.db.query('api::quiz.quiz').findOne({
      where: { documentId },
      populate: { course: { populate: { instructor: true } } },
    });
    ownerId = quiz?.course?.instructor?.id;
  } else {
    const ref = ctx.request.body?.data?.course;
    const courseKey =
      ref && typeof ref === 'object'
        ? ref.documentId ??
          ref.id ??
          (typeof ref.connect?.[0] === 'string'
            ? ref.connect?.[0]
            : ref.connect?.[0]?.documentId)
        : ref;
    if (!courseKey) return false;

    const course = await strapi.db.query('api::course.course').findOne({
      where:
        typeof courseKey === 'string'
          ? { documentId: courseKey }
          : { id: courseKey },
      populate: { instructor: true },
    });
    ownerId = course?.instructor?.id;
  }

  return ownerId !== undefined && ownerId === user.id;
};
