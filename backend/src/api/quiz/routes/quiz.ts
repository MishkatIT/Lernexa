import { factories } from '@strapi/strapi';

/**
 * Default CRUD is manager-only (grants) and ownership-gated for writes. find /
 * findOne return the raw quiz WITH isCorrect — students have no grant for them
 * and must use /take.
 */
const managerRoles = ['admin', 'content-manager', 'instructor'];

export default factories.createCoreRouter('api::quiz.quiz', {
  config: {
    create: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-quiz-owner',
      ],
    },
    update: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-quiz-owner',
      ],
    },
    delete: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-quiz-owner',
      ],
    },
  },
});
