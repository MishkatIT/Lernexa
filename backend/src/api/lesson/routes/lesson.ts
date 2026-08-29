import { factories } from '@strapi/strapi';

/**
 * Lessons are never listed publicly — students get lesson titles through the
 * course detail populate, and full content through Phase 4's /learn endpoint.
 * So find / findOne are granted only to the manager roles (layer 2), and every
 * write also passes global::is-lesson-owner (resolved through the course).
 *
 * find / findOne are ALSO ownership-scoped for instructors: the manager roles
 * are pinned on the route (not left implicit in the seed grant), findOne runs
 * `is-lesson-owner`, and the controller forces an owner filter on the list, so
 * an instructor cannot read a lesson body in a course they do not own.
 */
const managerRoles = ['admin', 'content-manager', 'instructor'];

export default factories.createCoreRouter('api::lesson.lesson', {
  config: {
    find: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
      ],
    },
    findOne: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-lesson-owner',
      ],
    },
    create: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-lesson-owner',
      ],
    },
    update: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-lesson-owner',
      ],
    },
    delete: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-lesson-owner',
      ],
    },
  },
});
