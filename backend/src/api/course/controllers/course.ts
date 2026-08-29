import { factories } from '@strapi/strapi';
import {
  computeProgress,
  computeProgressForCourse,
  nextLessonId,
} from '../../lesson-completion/services/progress';
import {
  PROGRESSION_MODES,
  lessonGates,
  normalizeProgression,
} from '../../lesson-completion/services/progression';

const UID = 'api::course.course';
const MANAGER_ROLES = ['admin', 'content-manager', 'instructor'];
const ENROLLMENT_UID = 'api::enrollment.enrollment';
const COMPLETION_UID = 'api::lesson-completion.lesson-completion';

/** Roster batch cap — one round of add/remove touches at most this many rows. */
const MAX_ROSTER_BATCH = 100;

/** Accepts `string[]` or a single blob (newline / comma / semicolon / space
 *  separated). Lower-cases, trims, keeps only plausible addresses, dedupes,
 *  and caps the batch. */
const parseEmailList = (raw: unknown): string[] => {
  const parts = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : typeof raw === 'string'
      ? raw.split(/[\s,;]+/)
      : [];
  const seen = new Set<string>();
  for (const p of parts) {
    const email = p.trim().toLowerCase();
    if (email.includes('@') && email.length <= 254) seen.add(email);
    if (seen.size >= MAX_ROSTER_BATCH) break;
  }
  return [...seen];
};

/** Positive integer user ids, deduped and capped. */
const parseStudentIds = (raw: unknown): number[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) seen.add(n);
    if (seen.size >= MAX_ROSTER_BATCH) break;
  }
  return [...seen];
};

type CoreHelpers = {
  sanitizeQuery(ctx: unknown): Promise<Record<string, unknown>>;
  sanitizeOutput(data: unknown, ctx: unknown): Promise<unknown>;
  transformResponse(data: unknown, meta?: unknown): unknown;
};

type CourseRow = {
  documentId: string;
  title: string;
  slug: string | null;
  description: string | null;
  coverImageUrl: string | null;
  lessonProgression: string | null;
  createdAt: string;
  instructor?: { fullName: string | null } | null;
  lessons?: Array<{ title: string; order: number }>;
};

/**
 * Explicit output shape. `sanitizeOutput` would strip `instructor` and `lessons`
 * for any caller without a read grant on those types — so instead we hand-pick
 * exactly the safe fields (D-004 discipline: the shape can only contain what it
 * names). Lesson `content` has no way in here.
 */
const shapeCourse = (c: CourseRow) => ({
  documentId: c.documentId,
  title: c.title,
  slug: c.slug,
  description: c.description ?? null,
  coverImageUrl: c.coverImageUrl ?? null,
  lessonProgression: normalizeProgression(c.lessonProgression),
  createdAt: c.createdAt,
  instructor: c.instructor ? { fullName: c.instructor.fullName ?? null } : null,
  lessons: (c.lessons ?? [])
    .map((l) => ({ title: l.title, order: l.order }))
    .sort((a, b) => a.order - b.order),
});

const SAFE_POPULATE = {
  instructor: { fields: ['fullName'] },
  lessons: { fields: ['title', 'order'], sort: ['order:asc'] },
};

/**
 * Course controller.
 *
 * - find / findOne: server-controlled population + explicit output shape, so a
 *   student can never pull lesson `content` through a course query
 *   (CVE-2026-27886 is this class). The public catalogue also hides courses
 *   with zero lessons — forced filter, applied last.
 * - create: an instructor's course is forced to instructor = ctx.state.user.id.
 *   A body-supplied `instructor` is ignored.
 * - delete: refuses with 409 while enrollments exist (D-020).
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const self = this as unknown as CoreHelpers;
    const role = ctx.state.user?.role?.type ?? '';
    const isManager = MANAGER_ROLES.includes(role);
    const sanitized = await self.sanitizeQuery(ctx);

    // Every server-forced clause is ANDed on top of the (already sanitised)
    // caller filters — never merged key-by-key, so a client filter can't widen
    // or overwrite one (D-005). Order inside `$and` doesn't matter; presence does.
    const and: unknown[] = [];
    const base = (sanitized.filters as Record<string, unknown>) ?? {};
    if (Object.keys(base).length > 0) and.push(base);

    // Free-text search: title OR description, case-insensitive. Spans the whole
    // result set — it's a WHERE clause, so pagination and the `total` count both
    // reflect the filtered set, never just the current page.
    const q = (ctx.query?.q ?? '').toString().trim();
    if (q) {
      and.push({
        $or: [{ title: { $containsi: q } }, { description: { $containsi: q } }],
      });
    }

    if (role === 'instructor') {
      // "Own courses only" (permission matrix). sanitizeQuery strips a
      // client-sent `filters[instructor][id]` because the instructor role has
      // no read grant on the user type, so the scope MUST be re-applied here or
      // an instructor's /manage list shows every course on the platform.
      // Mirrors the forced owner on `create` and the forced filter on
      // `lesson.find`.
      and.push({ instructor: { id: { $eq: ctx.state.user.id } } });
    } else if (!isManager) {
      // Public catalogue: hide courses with no lessons.
      and.push({ lessons: { id: { $notNull: true } } });
    }

    const filters = and.length > 0 ? { $and: and } : {};

    const { results, pagination } = await strapi.service(UID).find({
      ...sanitized,
      filters,
      fields: ['title', 'slug', 'description', 'coverImageUrl', 'lessonProgression', 'createdAt'],
      populate: SAFE_POPULATE,
    });

    return self.transformResponse((results as CourseRow[]).map(shapeCourse), {
      pagination,
    });
  },

  async findOne(ctx) {
    const self = this as unknown as CoreHelpers;
    const entity = (await strapi.service(UID).findOne(ctx.params.id, {
      fields: ['title', 'slug', 'description', 'coverImageUrl', 'lessonProgression', 'createdAt'],
      populate: SAFE_POPULATE,
    })) as CourseRow | null;

    if (!entity) return ctx.notFound();
    return self.transformResponse(shapeCourse(entity));
  },

  async create(ctx) {
    const self = this as unknown as CoreHelpers;
    const role = ctx.state.user?.role?.type;
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

    // Owner is decided here, never read raw from the body. Strapi 5.52 also
    // refuses a `user` relation in content-API input ("Invalid key instructor"),
    // so the course is written through the document service instead.
    let instructorId: number | undefined;
    if (role === 'instructor') {
      instructorId = ctx.state.user.id; // forced to self
    } else if (role === 'admin' || role === 'content-manager') {
      const raw = body.instructor;
      instructorId =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number(raw) || undefined
            : undefined;
    }

    // Explicit field allowlist — a course create only ever accepts these.
    const data: {
      title?: string;
      description?: string;
      coverImageUrl?: string;
      slug?: string;
      instructor?: number;
      lessonProgression?: string;
    } = {};
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.description === 'string') data.description = body.description;
    if (typeof body.coverImageUrl === 'string')
      data.coverImageUrl = body.coverImageUrl;
    if (instructorId) data.instructor = instructorId;
    // Progression rule (D-038). Anything not in the known set — including an
    // absent value — falls back to `free`, so a new course is always unlocked.
    data.lessonProgression = PROGRESSION_MODES.includes(
      body.lessonProgression as (typeof PROGRESSION_MODES)[number],
    )
      ? (body.lessonProgression as string)
      : 'free';

    // The uid lifecycle doesn't fire through the document service, so derive the
    // slug here: kebab-case the title + a short suffix for uniqueness.
    const slugBase =
      typeof body.slug === 'string' && body.slug ? body.slug : (data.title ?? 'course');
    data.slug = `${slugBase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`;

    const entity = (await strapi.documents(UID).create({
      // @ts-expect-error Input type rejects a bare relation id; the explicit
      // field allowlist above is the real guard.
      data,
      status: 'published',
    })) as CourseRow;

    await strapi.service('api::audit-log.audit-log').record({
      action: 'course.created',
      category: 'content',
      ctx,
      target: { type: 'course', id: entity.documentId, label: entity.title },
      metadata: { title: entity.title },
    });

    return self.transformResponse(shapeCourse(entity));
  },

  /**
   * PUT /api/courses/:id. Role + ownership are already enforced on the route
   * (global::has-role + global::is-course-owner), so a student never reaches
   * here and an instructor only ever hits their own course. We add one guard:
   * `lessonProgression`, if present, must be one of the three known modes —
   * otherwise the enum would let a bad value through and every progression
   * check would then fall back to `free` silently. Everything else is handled
   * by the core update.
   */
  async update(ctx) {
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    if (
      'lessonProgression' in body &&
      !PROGRESSION_MODES.includes(
        body.lessonProgression as (typeof PROGRESSION_MODES)[number],
      )
    ) {
      return ctx.badRequest(
        `lessonProgression must be one of: ${PROGRESSION_MODES.join(', ')}`,
      );
    }
    return super.update(ctx);
  },

  async delete(ctx) {
    const course = await strapi.db
      .query(UID)
      .findOne({ where: { documentId: ctx.params.id } });
    if (!course) return ctx.notFound();

    const enrolled = await strapi.db
      .query('api::enrollment.enrollment')
      .count({ where: { course: { id: course.id } } });

    if (enrolled > 0) {
      ctx.status = 409;
      ctx.body = {
        error: {
          status: 409,
          name: 'ConflictError',
          message: `Cannot delete "${course.title}" — ${enrolled} student${
            enrolled === 1 ? ' is' : 's are'
          } enrolled.`,
          details: { dependents: enrolled },
        },
      };
      return;
    }

    const result = await super.delete(ctx);

    await strapi.service('api::audit-log.audit-log').record({
      action: 'course.deleted',
      category: 'content',
      ctx,
      target: { type: 'course', id: course.documentId, label: course.title },
      metadata: { title: course.title },
    });

    return result;
  },

  /**
   * GET /api/courses/:id/learn — the whole learning context in one round trip
   * for an enrolled student: the course, its ordered lessons (with content —
   * this is the one place a student legitimately gets it), which are done, the
   * derived progress, and the next lesson. Two queries: lessons, completions.
   */
  async learn(ctx) {
    const userId = ctx.state.user.id;

    const course = await strapi.db.query(UID).findOne({
      where: { documentId: ctx.params.id },
    });
    if (!course) return ctx.notFound();

    const enrolled = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: { dedupeKey: `${userId}:${course.id}` },
    });
    if (!enrolled) return ctx.forbidden('You are not enrolled in this course');

    const lessons = (await strapi.db.query('api::lesson.lesson').findMany({
      where: { course: { id: course.id } },
      orderBy: { order: 'asc' },
    })) as Array<{
      id: number;
      documentId: string;
      title: string;
      order: number;
      content: string | null;
      videoUrl: string | null;
    }>;

    const completions = (await strapi.db
      .query('api::lesson-completion.lesson-completion')
      .findMany({
        where: { student: { id: userId }, course: { id: course.id } },
        populate: { lesson: true },
      })) as Array<{ lesson?: { id: number } | null }>;

    const doneIds = new Set(
      completions
        .map((c) => c.lesson?.id)
        .filter((id): id is number => typeof id === 'number'),
    );

    const quiz = (await strapi.db.query('api::quiz.quiz').findOne({
      where: { course: { id: course.id } },
      orderBy: { id: 'asc' },
    })) as { documentId: string } | null;

    const orderedForNext = lessons.map((l) => ({ id: l.documentId, order: l.order }));

    // Progression rule for this course (D-038). `lessonGates` runs the same pure
    // logic the `complete` controller enforces, so what the UI shows and what
    // the server allows can never drift.
    const mode = normalizeProgression(course.lessonProgression);
    const gates = lessonGates(
      mode,
      lessons.map((l) => ({ id: l.id, order: l.order })),
      [...doneIds],
    );
    const gateByLessonId = new Map(gates.map((g) => [String(g.id), g]));

    ctx.body = {
      data: {
        course: {
          id: course.documentId,
          title: course.title,
          slug: course.slug,
          lessonProgression: mode,
        },
        lessons: lessons.map((l) => {
          const gate = gateByLessonId.get(String(l.id));
          const locked = gate?.locked ?? false;
          return {
            id: l.documentId,
            title: l.title,
            order: l.order,
            // A locked lesson's body never leaves the server — a direct GET on
            // /learn can't be used to read ahead in `open_locked` mode.
            content: locked ? '' : (l.content ?? ''),
            videoUrl: locked ? '' : (l.videoUrl ?? ''),
            completed: doneIds.has(l.id),
            status: gate?.status ?? 'available',
            locked,
            canComplete: gate?.canComplete ?? true,
            lockHint: gate?.hint ?? null,
          };
        }),
        progress: computeProgress(
          lessons.map((l) => l.id),
          [...doneIds],
        ),
        nextLessonId: nextLessonId(
          orderedForNext,
          lessons.filter((l) => doneIds.has(l.id)).map((l) => l.documentId),
        ),
        quizId: quiz?.documentId ?? null,
      },
    };
  },

  /**
   * GET /api/courses/:id/student-progress — admin / content-manager / owning
   * instructor. The batched query PERFORMANCE.md #1 is about: three flat
   * queries (roster, lesson ids, all completions), then O(n) in memory — not
   * computeProgress in a loop over students.
   */
  async studentProgress(ctx) {
    const course = await strapi.db.query(UID).findOne({
      where: { documentId: ctx.params.id },
    });
    if (!course) return ctx.notFound();

    const roster = (await strapi.db
      .query('api::enrollment.enrollment')
      .findMany({
        where: { course: { id: course.id } },
        populate: { student: true },
        orderBy: { enrolledAt: 'asc' },
      })) as Array<{
      enrolledAt: string;
      student?: { id: number; fullName: string | null; username: string } | null;
    }>;

    const lessons = (await strapi.db
      .query('api::lesson.lesson')
      .findMany({ where: { course: { id: course.id } } })) as Array<{ id: number }>;

    const completions = (await strapi.db
      .query('api::lesson-completion.lesson-completion')
      .findMany({
        where: { course: { id: course.id } },
        populate: { student: true, lesson: true },
      })) as Array<{
      completedAt: string;
      student?: { id: number } | null;
      lesson?: { id: number } | null;
    }>;

    const lessonIds = lessons.map((l) => l.id);
    const progressByStudent = computeProgressForCourse(
      lessonIds,
      completions
        .filter((c) => c.student && c.lesson)
        .map((c) => ({ studentId: c.student!.id, lessonId: c.lesson!.id })),
    );

    const lastActivityByStudent = new Map<number, string>();
    for (const c of completions) {
      if (!c.student) continue;
      const prev = lastActivityByStudent.get(c.student.id);
      if (!prev || c.completedAt > prev) {
        lastActivityByStudent.set(c.student.id, c.completedAt);
      }
    }

    const empty = { completed: 0, total: lessonIds.length, percent: 0 };
    const data = roster
      .filter((r) => r.student)
      .map((r) => ({
        student: {
          id: r.student!.id,
          name: r.student!.fullName ?? r.student!.username,
        },
        enrolledAt: r.enrolledAt,
        lastActivity: lastActivityByStudent.get(r.student!.id) ?? null,
        progress: progressByStudent.get(String(r.student!.id)) ?? empty,
      }))
      .sort((a, b) => a.progress.percent - b.progress.percent); // stuck first

    ctx.body = { data };
  },

  /**
   * POST /api/courses/:id/enrollments — manager adds students by email.
   * Route-gated by has-role(manager) + is-course-owner, so an instructor only
   * reaches their own course. Students are resolved by email server-side (the
   * instructor role has no read grant on users, so no id/list is ever exposed).
   * Idempotent per email; partial success is a 200 with a per-email breakdown.
   *
   * body: { emails: string[] | string, resetProgress?: boolean }
   *   resetProgress — clear each student's completions for THIS course so they
   *   start from 0%. Off by default: a re-add resumes prior progress, since
   *   completions are never deleted on unenrol.
   */
  async addEnrollments(ctx) {
    const course = await strapi.db
      .query(UID)
      .findOne({ where: { documentId: ctx.params.id } });
    if (!course) return ctx.notFound();

    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const src = (body.data ?? body) as Record<string, unknown>;
    const emails = parseEmailList(src.emails);
    const resetProgress = src.resetProgress === true || src.resetProgress === 'true';
    if (emails.length === 0) {
      return ctx.badRequest('Provide at least one email address.');
    }

    type Outcome =
      | 'enrolled'
      | 'already-enrolled'
      | 'not-found'
      | 'not-a-student'
      | 'blocked';
    const results: Array<{ email: string; status: Outcome; name?: string }> = [];
    let added = 0;

    for (const email of emails) {
      const user = (await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({
          where: { email: { $eqi: email } },
          populate: { role: true },
        })) as {
        id: number;
        blocked: boolean;
        fullName: string | null;
        username: string;
        role?: { type?: string } | null;
      } | null;

      if (!user) {
        results.push({ email, status: 'not-found' });
        continue;
      }
      const name = user.fullName ?? user.username;
      if (user.role?.type !== 'student') {
        results.push({ email, status: 'not-a-student', name });
        continue;
      }
      if (user.blocked) {
        results.push({ email, status: 'blocked', name });
        continue;
      }

      const dedupeKey = `${user.id}:${course.id}`;
      const existing = await strapi.db
        .query(ENROLLMENT_UID)
        .findOne({ where: { dedupeKey } });

      if (!existing) {
        await strapi.db.query(ENROLLMENT_UID).create({
          data: {
            student: user.id,
            course: course.id,
            enrolledAt: new Date(),
            dedupeKey,
            publishedAt: new Date(),
          },
        });
        added += 1;
      }
      if (resetProgress) {
        await strapi.db.query(COMPLETION_UID).deleteMany({
          where: { student: { id: user.id }, course: { id: course.id } },
        });
      }
      results.push({
        email,
        status: existing ? 'already-enrolled' : 'enrolled',
        name,
      });
    }

    await strapi.service('api::audit-log.audit-log').record({
      action: 'enrollment.added',
      category: 'content',
      ctx,
      target: { type: 'course', id: course.documentId, label: course.title },
      metadata: {
        requested: emails.length,
        added,
        resetProgress,
        results,
      },
    });

    ctx.body = { data: { added, requested: emails.length, results } };
  },

  /**
   * POST /api/courses/:id/enrollments/remove — manager removes students.
   * Same route gate. Only the enrolment row is deleted; completions are kept
   * unless `purgeProgress` is set, so an accidental removal can be undone by a
   * plain re-add. `purgeProgress` also lets a manager fully detach a student
   * (and makes the course deletable without leftover progress rows).
   *
   * body: { studentIds: number[], purgeProgress?: boolean }
   */
  async removeEnrollments(ctx) {
    const course = await strapi.db
      .query(UID)
      .findOne({ where: { documentId: ctx.params.id } });
    if (!course) return ctx.notFound();

    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const src = (body.data ?? body) as Record<string, unknown>;
    const studentIds = parseStudentIds(src.studentIds);
    const purgeProgress =
      src.purgeProgress === true || src.purgeProgress === 'true';
    if (studentIds.length === 0) {
      return ctx.badRequest('Provide at least one studentId.');
    }

    const { count: removed } = await strapi.db.query(ENROLLMENT_UID).deleteMany({
      where: {
        course: { id: course.id },
        student: { id: { $in: studentIds } },
      },
    });

    let purged = 0;
    if (purgeProgress) {
      ({ count: purged } = await strapi.db.query(COMPLETION_UID).deleteMany({
        where: {
          course: { id: course.id },
          student: { id: { $in: studentIds } },
        },
      }));
    }

    await strapi.service('api::audit-log.audit-log').record({
      action: 'enrollment.removed',
      category: 'content',
      ctx,
      target: { type: 'course', id: course.documentId, label: course.title },
      metadata: { studentIds, removed, purgeProgress, purged },
    });

    ctx.body = { data: { removed, purged } };
  },
}));
