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
    // Visibility toggle (D-039). Same gate as edit/delete: manager role + course
    // ownership. `unpublish` accepts { mode: 'enrolled_only' | 'draft' }.
    {
      method: 'POST',
      path: '/courses/:id/publish',
      handler: 'course.publish',
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
    {
      method: 'POST',
      path: '/courses/:id/unpublish',
      handler: 'course.unpublish',
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
    // Instructor home rollup across every owned course — one request instead of
    // the frontend's 1 + N fan-out. Literal path segment `manage` so it never
    // collides with `/courses/:id`. Scoping to own courses happens in the
    // handler; no per-course ownership policy applies (there is no :id).
    {
      method: 'GET',
      path: '/courses/manage/snapshot',
      handler: 'course.manageSnapshot',
      config: {
        policies: [
          {
            name: 'global::has-role',
            config: { roles: ['admin', 'content-manager', 'instructor'] },
          },
        ],
      },
    },
    // Roster management. Same gate as edit/delete: manager role + course
    // ownership (admin / CM pass, instructor must own the course). Distinct
    // from the student-only self-enrol route (POST /api/enrollments/enroll) —
    // this is "manage this course's roster", not "enrol me".
    {
      method: 'POST',
      path: '/courses/:id/enrollments',
      handler: 'course.addEnrollments',
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
    {
      method: 'POST',
      path: '/courses/:id/enrollments/remove',
      handler: 'course.removeEnrollments',
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
