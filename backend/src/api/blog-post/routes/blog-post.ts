import { factories } from '@strapi/strapi';

/**
 * find / findOne are open (the controller forces published-only for
 * non-managers). Writes are admin + content-manager — no ownership check, both
 * roles manage all blog content. Instructors and students have no write grant.
 */
const writers = ['admin', 'content-manager'];

export default factories.createCoreRouter('api::blog-post.blog-post', {
  config: {
    create: {
      policies: [{ name: 'global::has-role', config: { roles: writers } }],
    },
    update: {
      policies: [{ name: 'global::has-role', config: { roles: writers } }],
    },
    delete: {
      policies: [{ name: 'global::has-role', config: { roles: writers } }],
    },
  },
});
