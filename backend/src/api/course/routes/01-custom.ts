/**
 * Custom course routes. Loaded alongside the core router (routes/course.ts);
 * the `01-` prefix just makes the ordering explicit.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/courses/:id/learn',
      handler: 'course.learn',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
    {
      method: 'GET',
      path: '/courses/:id/student-progress',
      handler: 'course.studentProgress',
      config: {
        policies: [
          {
            name: 'global::has-role',
            config: { roles: ['admin', 'content-manager', 'instructor'] },
          },
          'global::is-course-owner',
        ],
      },
    },
  ],
};
