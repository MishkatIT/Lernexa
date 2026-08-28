import type { Core } from '@strapi/strapi';

/**
 * The four application roles from the spec's permission matrix. These are
 * Users & Permissions roles on end users — NOT Strapi admin-panel accounts.
 *
 * `type` is the stable slug the code checks against (ctx.state.user.role.type).
 */
const APPLICATION_ROLES = [
  {
    name: 'Admin',
    type: 'admin',
    description: 'Full platform administration: users, roles, all content, settings.',
  },
  {
    name: 'Content Manager',
    type: 'content-manager',
    description: 'Create, edit and delete any course, lesson, quiz or blog post.',
  },
  {
    name: 'Instructor',
    type: 'instructor',
    description: 'Create and manage own courses and their lessons and quizzes.',
  },
  {
    name: 'Student',
    type: 'student',
    description: 'Browse and enrol in courses, view lessons, take quizzes.',
  },
];

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * Ensure the four application roles exist on every boot so a fresh deploy is
   * usable. Idempotent: a role that already exists is left untouched.
   *
   * Deny by default — no permissions are granted here. A newly created U&P role
   * has zero enabled permissions, so every guarded endpoint returns 403 for it
   * until Phase 3 opens the exact cells of the RBAC matrix. Bootstrap never
   * touches the built-in `authenticated` / `public` roles and never creates
   * user accounts (that is the Phase 7 seed script).
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const roles = strapi.db.query('plugin::users-permissions.role');

    for (const role of APPLICATION_ROLES) {
      const existing = await roles.findOne({ where: { type: role.type } });
      if (existing) continue;

      await roles.create({ data: role });
      strapi.log.info(`[bootstrap] created application role "${role.type}"`);
    }
  },
};
