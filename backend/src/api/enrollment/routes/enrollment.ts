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
    {
      // The whole student dashboard in ONE round trip — enrolments + progress,
      // quiz attempts, and the resume card's next lesson. Replaces 3 separate
      // calls, which matters when each cross-region hop to the API costs ~2s.
      method: 'GET',
      path: '/enrollments/me/dashboard',
      handler: 'enrollment.dashboard',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
  ],
};
