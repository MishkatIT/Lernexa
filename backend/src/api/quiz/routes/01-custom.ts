/** Student quiz routes — sanitised take, server-side submit. */
export default {
  routes: [
    {
      method: 'GET',
      path: '/quizzes/:id/take',
      handler: 'quiz.take',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
    {
      method: 'POST',
      path: '/quizzes/:id/submit',
      handler: 'quiz.submit',
      config: {
        policies: [{ name: 'global::has-role', config: { roles: ['student'] } }],
      },
    },
  ],
};
