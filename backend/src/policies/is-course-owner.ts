import type { Core } from '@strapi/strapi';
import type { PolicyContext } from './_policy-context';

/**
 * global::is-course-owner — for routes addressed by course id
 * (PUT/DELETE /api/courses/:id).
 *
 * admin and content-manager manage any course. An instructor may only touch a
 * course whose `instructor` relation is themselves. Not found, or found and not
 * yours → false → 403 (D-007).
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
  if (!documentId) return false;

  const course = await strapi.db.query('api::course.course').findOne({
    where: { documentId },
    populate: { instructor: true },
  });

  return Boolean(course && course.instructor?.id === user.id);
};
