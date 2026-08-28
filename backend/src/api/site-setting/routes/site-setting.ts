import { factories } from '@strapi/strapi';

/**
 * Single type: GET is public (header + register gate need it), PUT is admin-only.
 */
export default factories.createCoreRouter('api::site-setting.site-setting', {
  config: {
    update: {
      policies: [{ name: 'global::has-role', config: { roles: ['admin'] } }],
    },
  },
});
