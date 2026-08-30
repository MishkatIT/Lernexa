/**
 * Quiz visibility toggle (D-039). Same gate as the write CRUD in routes/quiz.ts:
 * a manager role, and for an instructor `is-quiz-owner` (quiz → course →
 * instructor). Distinct from the student `/take` + `/submit` routes.
 */
const managerRoles = ['admin', 'content-manager', 'instructor'];

const gate = {
  policies: [
    { name: 'global::has-role', config: { roles: managerRoles } },
    'global::is-quiz-owner',
  ],
};

export default {
  routes: [
    {
      method: 'POST',
      path: '/quizzes/:id/publish',
      handler: 'quiz.publish',
      config: gate,
    },
    {
      method: 'POST',
      path: '/quizzes/:id/unpublish',
      handler: 'quiz.unpublish',
      config: gate,
    },
  ],
};
