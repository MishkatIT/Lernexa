/**
 * Only mark / un-mark exist — no default CRUD. Student-only; identity from the
 * token, enrollment checked inside the controller.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/lesson-completions/complete',
      handler: 'lesson-completion.complete',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
    {
      method: 'DELETE',
      path: '/lesson-completions/:lessonId',
      handler: 'lesson-completion.uncomplete',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
  ],
};
