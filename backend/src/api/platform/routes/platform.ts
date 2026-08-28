/**
 * Every platform route is admin-only, two ways: the has-role policy and the
 * is-admin policy. Content-manager hitting any of these is a 403 (verified).
 */
const adminOnly = {
  policies: [
    { name: 'global::has-role', config: { roles: ['admin'] } },
    'global::is-admin',
  ],
};

export default {
  routes: [
    { method: 'GET', path: '/platform/users', handler: 'platform.users', config: adminOnly },
    {
      method: 'PUT',
      path: '/platform/users/:id/role',
      handler: 'platform.setRole',
      config: adminOnly,
    },
    {
      method: 'PUT',
      path: '/platform/users/:id/block',
      handler: 'platform.setBlock',
      config: adminOnly,
    },
    { method: 'GET', path: '/platform/stats', handler: 'platform.stats', config: adminOnly },
  ],
};
