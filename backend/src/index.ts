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

/**
 * RBAC as code — DECISIONS.md D-029. Permissions are granted here, not clicked
 * in the plugin UI, so local and Railway always agree and the grant is
 * reviewable in version control. Deny by default: a role gets exactly the
 * actions listed for it and nothing else.
 *
 * Phase 2 grants only `user.me` (needed for getCurrentUser on the frontend).
 * Phase 3 extends this map to the full permission matrix (RBAC.md).
 */
const ROLE_GRANTS: Record<string, string[]> = {
  admin: ['plugin::users-permissions.user.me'],
  'content-manager': ['plugin::users-permissions.user.me'],
  instructor: ['plugin::users-permissions.user.me'],
  student: ['plugin::users-permissions.user.me'],
};

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * On every boot: ensure the four application roles exist and hold exactly the
   * permissions in ROLE_GRANTS. Idempotent — existing roles and grants are left
   * alone; nothing is revoked here. Never touches `authenticated` / `public`,
   * never creates user accounts (that is the Phase 7 seed script).
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const roleRepo = strapi.db.query('plugin::users-permissions.role');
    const permRepo = strapi.db.query('plugin::users-permissions.permission');

    for (const role of APPLICATION_ROLES) {
      let record = await roleRepo.findOne({ where: { type: role.type } });
      if (!record) {
        record = await roleRepo.create({ data: role });
        strapi.log.info(`[bootstrap] created application role "${role.type}"`);
      }

      for (const action of ROLE_GRANTS[role.type] ?? []) {
        const exists = await permRepo.findOne({
          where: { action, role: record.id },
        });
        if (!exists) {
          await permRepo.create({ data: { action, role: record.id } });
          strapi.log.info(`[bootstrap] granted ${action} -> "${role.type}"`);
        }
      }
    }
  },
};
