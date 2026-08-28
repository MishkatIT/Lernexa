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

// Phase 4 — learning + progress.
const STUDENT_LEARNING = [
  'api::enrollment.enrollment.enroll',
  'api::enrollment.enrollment.me',
  'api::lesson-completion.lesson-completion.complete',
  'api::lesson-completion.lesson-completion.uncomplete',
  'api::course.course.learn',
];
const STUDENT_PROGRESS_VIEW = ['api::course.course.studentProgress'];

// Phase 5 — quizzes.
const QUIZ_MANAGE = [
  'api::quiz.quiz.find',
  'api::quiz.quiz.findOne',
  'api::quiz.quiz.create',
  'api::quiz.quiz.update',
  'api::quiz.quiz.delete',
];
const STUDENT_QUIZ = [
  'api::quiz.quiz.take',
  'api::quiz.quiz.submit',
  'api::quiz-attempt.quiz-attempt.me',
];

// Phase 6 — admin platform + site settings.
const PLATFORM_ADMIN = [
  'api::platform.platform.users',
  'api::platform.platform.setRole',
  'api::platform.platform.setBlock',
  'api::platform.platform.stats',
  'api::platform.platform.audit',
  'api::site-setting.site-setting.update',
];
const SETTINGS_READ = ['api::site-setting.site-setting.find'];

// Phase 7 — blog.
const BLOG_READ = [
  'api::blog-post.blog-post.find',
  'api::blog-post.blog-post.findOne',
];
const BLOG_WRITE = [
  'api::blog-post.blog-post.create',
  'api::blog-post.blog-post.update',
  'api::blog-post.blog-post.delete',
  'api::blog-post.blog-post.publish',
  'api::blog-post.blog-post.unpublish',
];

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
// Every authenticated role can read and edit their own profile + change password.
const SELF_SERVICE = [
  'plugin::users-permissions.user.me',
  'plugin::users-permissions.user.updateMe',
  'plugin::users-permissions.auth.changePassword',
];

const ROLE_GRANTS: Record<string, string[]> = {
  admin: [
    ...SELF_SERVICE,
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...LESSON_ALL,
    ...QUIZ_MANAGE,
    ...STUDENT_PROGRESS_VIEW,
    ...PLATFORM_ADMIN,
    ...SETTINGS_READ,
    ...BLOG_READ,
    ...BLOG_WRITE,
  ],
  'content-manager': [
    ...SELF_SERVICE,
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...LESSON_ALL,
    ...QUIZ_MANAGE,
    ...STUDENT_PROGRESS_VIEW,
    ...SETTINGS_READ,
    ...BLOG_READ,
    ...BLOG_WRITE,
  ],
  instructor: [
    ...SELF_SERVICE,
    ...COURSE_READ,
    ...COURSE_WRITE,
    ...LESSON_ALL,
    ...QUIZ_MANAGE,
    ...STUDENT_PROGRESS_VIEW,
    ...SETTINGS_READ,
    ...BLOG_READ,
  ],
  student: [
    ...SELF_SERVICE,
    ...COURSE_READ,
    ...STUDENT_LEARNING,
    ...STUDENT_QUIZ,
    ...SETTINGS_READ,
    ...BLOG_READ,
  ],
};

/** Actions granted to the built-in `public` role (anonymous visitors). */
const PUBLIC_GRANTS = [...COURSE_READ, ...SETTINGS_READ, ...BLOG_READ];

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

    // Ensure the SiteSettings single-type row exists so the register gate and
    // the header have something to read on a fresh deploy.
    try {
      const settingsRepo = strapi.db.query('api::site-setting.site-setting');
      const existing = await settingsRepo.findOne({});
      if (!existing) {
        await settingsRepo.create({
          data: {
            siteName: 'Lernexa',
            registrationEnabled: true,
            publishedAt: new Date(),
          },
        });
        strapi.log.info('[bootstrap] created SiteSettings row');
      }
    } catch (err) {
      // The table may not exist yet on a first sync — never let this crash boot.
      strapi.log.warn(
        `[bootstrap] could not ensure SiteSettings row: ${(err as Error).message}`,
      );
    }
  },
};
