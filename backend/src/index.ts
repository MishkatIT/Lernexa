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

const COURSE_WRITE = [
  'api::course.course.create',
  'api::course.course.update',
  'api::course.course.delete',
];
const LESSON_ALL = [
  'api::lesson.lesson.find',
  'api::lesson.lesson.findOne',
  'api::lesson.lesson.create',
  'api::lesson.lesson.update',
  'api::lesson.lesson.delete',
];
const COURSE_READ = ['api::course.course.find', 'api::course.course.findOne'];

/**
 * RBAC as code — DECISIONS.md D-029. Every guarded action a role may call is
 * listed here and applied idempotently on boot, so local and Railway always
 * agree and the grant is reviewable in the diff. Deny by default: a role gets
 * exactly these actions.
 *
 * This is layer 2 (can this role call this action?). Layer 3 route policies
 * (is-course-owner, is-lesson-owner) still decide *which rows* — e.g. an
 * instructor is granted course.update here but the policy limits it to their
 * own courses. `users-permissions.user.find` / `.update` are deliberately
 * granted to nobody: Phase 6 gives admin its own /api/platform/* surface.
 */
const ROLE_GRANTS: Record<string, string[]> = {
  admin: [
    'plugin::users-permissions.user.me',
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...LESSON_ALL,
  ],
  'content-manager': [
    'plugin::users-permissions.user.me',
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...LESSON_ALL,
  ],
  instructor: [
    'plugin::users-permissions.user.me',
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...LESSON_ALL,
  ],
  student: ['plugin::users-permissions.user.me', ...COURSE_READ],
};

/** Actions granted to the built-in `public` role (anonymous visitors). */
const PUBLIC_GRANTS = [...COURSE_READ];

export default {
  register(/* { strapi } */) {},

  /**
   * On every boot: ensure the four application roles exist and hold at least
   * the permissions in ROLE_GRANTS (and PUBLIC_GRANTS for anonymous). Idempotent
   * and additive — nothing is revoked here. Never creates user accounts.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const roleRepo = strapi.db.query('plugin::users-permissions.role');
    const permRepo = strapi.db.query('plugin::users-permissions.permission');

    const grant = async (roleId: number, actions: string[], label: string) => {
      for (const action of actions) {
        const exists = await permRepo.findOne({ where: { action, role: roleId } });
        if (!exists) {
          await permRepo.create({ data: { action, role: roleId } });
          strapi.log.info(`[bootstrap] granted ${action} -> "${label}"`);
        }
      }
    };

    for (const role of APPLICATION_ROLES) {
      let record = await roleRepo.findOne({ where: { type: role.type } });
      if (!record) {
        record = await roleRepo.create({ data: role });
        strapi.log.info(`[bootstrap] created application role "${role.type}"`);
      }
      await grant(record.id, ROLE_GRANTS[role.type] ?? [], role.type);
    }

    const publicRole = await roleRepo.findOne({ where: { type: 'public' } });
    if (publicRole) await grant(publicRole.id, PUBLIC_GRANTS, 'public');
  },
};
