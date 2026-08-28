/** Only the caller's own attempts. No default CRUD. */
export default {
  routes: [
    {
      method: 'GET',
      path: '/quiz-attempts/me',
      handler: 'quiz-attempt.me',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
  ],
};
