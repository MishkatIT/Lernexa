import type { Core } from '@strapi/strapi';
import type { PolicyContext } from './_policy-context';

/**
 * global::is-lesson-owner — ownership resolved through the lesson's course.
 *
 *   - PUT/DELETE /api/lessons/:id → load the lesson, walk lesson → course →
 *     instructor.
 *   - POST /api/lessons           → no lesson yet; the target course is in the
 *     body. "Instructor A adds a lesson to B's course" is caught here.
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
    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: { documentId },
      populate: { course: { populate: { instructor: true } } },
    });
    ownerId = lesson?.course?.instructor?.id;
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
