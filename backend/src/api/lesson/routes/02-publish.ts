/**
 * Lesson visibility toggle (D-039). Same gate as the write CRUD in
 * routes/lesson.ts: a manager role, and for an instructor `is-lesson-owner`
 * (lesson → course → instructor).
 */
const managerRoles = ['admin', 'content-manager', 'instructor'];

const gate = {
  policies: [
    { name: 'global::has-role', config: { roles: managerRoles } },
    'global::is-lesson-owner',
  ],
};

export default {
  routes: [
    {
      method: 'POST',
      path: '/lessons/:id/publish',
      handler: 'lesson.publish',
      config: gate,
    },
    {
      method: 'POST',
      path: '/lessons/:id/unpublish',
      handler: 'lesson.unpublish',
      config: gate,
    },
  ],
};
