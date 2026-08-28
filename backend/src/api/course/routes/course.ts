import { factories } from '@strapi/strapi';

/**
 * find / findOne are open (layer 2 grants them to public + every role — course
 * titles are public). create / update / delete are role-gated here and, for
 * update / delete, ownership-gated: an instructor only touches their own course.
 */
export default factories.createCoreRouter('api::course.course', {
  config: {
    create: {
      policies: [
        {
          name: 'global::has-role',
          config: { roles: ['admin', 'content-manager', 'instructor'] },
        },
      ],
    },
    update: {
      policies: [
        {
          name: 'global::has-role',
          config: { roles: ['admin', 'content-manager', 'instructor'] },
        },
        'global::is-course-owner',
      ],
    },
    delete: {
      policies: [
        {
          name: 'global::has-role',
          config: { roles: ['admin', 'content-manager', 'instructor'] },
        },
        'global::is-course-owner',
      ],
    },
  },
});
