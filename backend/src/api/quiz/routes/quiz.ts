import { factories } from '@strapi/strapi';

/**
 * Default CRUD is manager-only (grants) and ownership-gated for writes. find /
 * findOne return the raw quiz WITH isCorrect — students have no grant for them
 * and must use /take.
 *
 * find / findOne are ALSO ownership-scoped for instructors: the route pins the
 * manager roles explicitly (not just the seed grant), findOne runs
 * `is-quiz-owner`, and the controller forces an owner filter on the list. An
 * instructor must never read another instructor's answer key.
 */
const managerRoles = ['admin', 'content-manager', 'instructor'];

export default factories.createCoreRouter('api::quiz.quiz', {
  config: {
    find: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
      ],
    },
    findOne: {
      policies: [
        { name: 'global::has-role', config: { roles: managerRoles } },
        'global::is-quiz-owner',
      ],
    },
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
