import type { Core } from '@strapi/strapi';

const USER = 'plugin::users-permissions.user';
const ROLE = 'plugin::users-permissions.role';
const APP_ROLE_TYPES = ['admin', 'content-manager', 'instructor', 'student'];

const clampPageSize = (raw: unknown, max: number) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(Math.trunc(n), max);
};

const shapeUser = (u: {
  id: number;
  fullName: string | null;
  username: string;
  email: string;
  blocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  role?: { type: string; name: string } | null;
}) => ({
  id: u.id,
  fullName: u.fullName ?? null,
  username: u.username,
  email: u.email,
  blocked: u.blocked,
  blockedReason: u.blockedReason ?? null,
  blockedAt: u.blockedAt ?? null,
  role: u.role ? { type: u.role.type, name: u.role.name } : null,
});

async function countAdmins(strapi: Core.Strapi, opts: { unblockedOnly?: boolean } = {}) {
  return strapi.db.query(USER).count({
    where: {
      role: { type: 'admin' },
      ...(opts.unblockedOnly ? { blocked: false } : {}),
    },
  });
}

/**
 * /api/platform/* — admin only (has-role + is-admin on the routes). Every
 * sensitive action walks: exists → not self → not last admin → valid
 * transition → act (RBAC.md "the full sensitive-action chain").
 */
export default {
  /** GET /api/platform/users?page&pageSize&q&role&status */
  async users(ctx: any) {
    const { strapi } = ctx.state.route || {};
    const s: Core.Strapi = strapi ?? global.strapi;

    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = clampPageSize(ctx.query.pageSize, 100);
    const q = (ctx.query.q ?? '').toString().trim();
    const roleType = (ctx.query.role ?? '').toString().trim();
    const status = (ctx.query.status ?? '').toString().trim();

    const where: Record<string, unknown> = {};
    if (q) {
      where.$or = [
        { fullName: { $containsi: q } },
        { username: { $containsi: q } },
        { email: { $containsi: q } },
      ];
    }
    if (APP_ROLE_TYPES.includes(roleType)) where.role = { type: roleType };
    if (status === 'blocked') where.blocked = true;
    if (status === 'active') where.blocked = false;

    const [rows, total] = await Promise.all([
      s.db.query(USER).findMany({
        where,
        populate: { role: true },
        orderBy: { id: 'asc' },
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
      s.db.query(USER).count({ where }),
    ]);

    ctx.body = {
      data: (rows as Parameters<typeof shapeUser>[0][]).map(shapeUser),
      meta: { pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } },
    };
  },

  /** PUT /api/platform/users/:id/role  body { role: <type> } */
  async setRole(ctx: any) {
    const s: Core.Strapi = global.strapi;
    const actorId = ctx.state.user.id;
    const targetId = Number(ctx.params.id);
    const nextType = (ctx.request.body?.role ?? '').toString();

    if (!APP_ROLE_TYPES.includes(nextType)) {
      return ctx.badRequest('Unknown role');
    }

    const target = await s.db
      .query(USER)
      .findOne({ where: { id: targetId }, populate: { role: true } });
    if (!target) return ctx.notFound('No such user');

    if (target.id === actorId) {
      return ctx.badRequest('You cannot change your own role');
    }
    if (target.role?.type === nextType) {
      return ctx.badRequest(`Already ${nextType}`);
    }
    if (target.role?.type === 'admin' && (await countAdmins(s)) <= 1) {
      return ctx.badRequest('Cannot demote the last admin');
    }

    const role = await s.db.query(ROLE).findOne({ where: { type: nextType } });
    await s.db.query(USER).update({
      where: { id: targetId },
      data: { role: role.id },
    });

    const updated = await s.db
      .query(USER)
      .findOne({ where: { id: targetId }, populate: { role: true } });
    ctx.body = { data: shapeUser(updated as Parameters<typeof shapeUser>[0]) };
  },

  /** PUT /api/platform/users/:id/block  body { blocked: bool, reason?: string } */
  async setBlock(ctx: any) {
    const s: Core.Strapi = global.strapi;
    const actorId = ctx.state.user.id;
    const targetId = Number(ctx.params.id);
    const blocked = ctx.request.body?.blocked === true;
    const reason = (ctx.request.body?.reason ?? '').toString().trim();

    const target = await s.db
      .query(USER)
      .findOne({ where: { id: targetId }, populate: { role: true } });
    if (!target) return ctx.notFound('No such user');

    if (target.id === actorId) {
      return ctx.badRequest('You cannot block your own account');
    }
    if (target.blocked === blocked) {
      return ctx.badRequest(blocked ? 'Already blocked' : 'Already active');
    }
    if (blocked) {
      if (!reason) return ctx.badRequest('A reason is required');
      if (reason.length > 500) return ctx.badRequest('Reason is too long (500 max)');
      if (
        target.role?.type === 'admin' &&
        (await countAdmins(s, { unblockedOnly: true })) <= 1
      ) {
        return ctx.badRequest('Cannot block the last admin');
      }
    }

    await s.db.query(USER).update({
      where: { id: targetId },
      data: blocked
        ? {
            blocked: true,
            blockedReason: reason,
            blockedAt: new Date(),
            blockedBy: actorId,
          }
        : { blocked: false, blockedReason: null, blockedAt: null, blockedBy: null },
    });

    const updated = await s.db
      .query(USER)
      .findOne({ where: { id: targetId }, populate: { role: true } });
    ctx.body = { data: shapeUser(updated as Parameters<typeof shapeUser>[0]) };
  },

  /** GET /api/platform/stats — parallel counts + the attention queue. */
  async stats(ctx: any) {
    const s: Core.Strapi = global.strapi;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      admins,
      contentManagers,
      instructors,
      students,
      blockedUsers,
      totalCourses,
      totalEnrollments,
      totalAttempts,
      recentCompletions,
      allQuizzes,
      courses,
      lessons,
      completionsCount,
    ] = await Promise.all([
      s.db.query(USER).count({}),
      s.db.query(USER).count({ where: { role: { type: 'admin' } } }),
      s.db.query(USER).count({ where: { role: { type: 'content-manager' } } }),
      s.db.query(USER).count({ where: { role: { type: 'instructor' } } }),
      s.db.query(USER).count({ where: { role: { type: 'student' } } }),
      s.db.query(USER).count({ where: { blocked: true } }),
      s.db.query('api::course.course').count({}),
      s.db.query('api::enrollment.enrollment').count({}),
      s.db.query('api::quiz-attempt.quiz-attempt').count({}),
      s.db.query('api::lesson-completion.lesson-completion').findMany({
        where: { completedAt: { $gt: sevenDaysAgo } },
        populate: { student: true },
      }),
      s.db.query('api::quiz.quiz').findMany({
        populate: { questions: { populate: { options: true } } },
      }),
      s.db.query('api::course.course').findMany({ populate: { lessons: true } }),
      s.db.query('api::lesson.lesson').count({}),
      s.db.query('api::lesson-completion.lesson-completion').count({}),
    ]);

    const activeLast7Days = new Set(
      (recentCompletions as Array<{ student?: { id: number } | null }>)
        .map((c) => c.student?.id)
        .filter(Boolean),
    ).size;

    const coursesWithoutLessons = (
      courses as Array<{ lessons?: unknown[] }>
    ).filter((c) => (c.lessons ?? []).length === 0).length;

    const quizzesWithoutCorrectAnswer = (
      allQuizzes as Array<{
        questions?: Array<{ options?: Array<{ isCorrect?: boolean }> }>;
      }>
    ).filter((qz) =>
      (qz.questions ?? []).some(
        (qn) => !(qn.options ?? []).some((o) => o.isCorrect === true),
      ),
    ).length;

    // Rough overall completion: recorded completions vs. every (enrolment ×
    // lesson) pair. Good enough for a dashboard number.
    const possible =
      lessons > 0 && totalCourses > 0
        ? Math.round((totalEnrollments * lessons) / totalCourses)
        : 0;
    const overallCompletionPercent =
      possible > 0 ? Math.round((completionsCount / possible) * 100) : 0;

    ctx.body = {
      data: {
        users: {
          total: totalUsers,
          admins,
          contentManagers,
          instructors,
          students,
          blocked: blockedUsers,
          activeLast7Days,
        },
        content: {
          courses: totalCourses,
          coursesWithoutLessons,
          enrollments: totalEnrollments,
          quizAttempts: totalAttempts,
          overallCompletionPercent,
        },
        attention: {
          quizzesWithoutCorrectAnswer,
          coursesWithoutLessons,
          blockedUsers,
        },
      },
    };
  },
};
