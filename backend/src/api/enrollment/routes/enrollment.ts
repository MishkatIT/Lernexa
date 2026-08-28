/**
 * Only these two routes exist for enrollment — no default CRUD. Both are
 * student-only (layer 3 `has-role`); the student id inside comes from the token
 * (layer 4-style — identity is never read from the body).
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/enrollments/enroll',
      handler: 'enrollment.enroll',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
    {
      method: 'GET',
      path: '/enrollments/me',
      handler: 'enrollment.me',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
  ],
};
