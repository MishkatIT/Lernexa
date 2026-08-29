import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';
import { computeProgress } from '../services/progress';
import {
  canCompleteLesson,
  normalizeProgression,
} from '../services/progression';

const UID = 'api::lesson-completion.lesson-completion';

/**
 * Marking a lesson complete. The student is ctx.state.user. The `course` is
 * copied from lesson.course server-side, never from the request. An active
 * enrollment for that course is required. Upsert on dedupeKey so a double-click
 * is idempotent.
 */
async function progressFor(strapi: Core.Strapi, userId: number, courseId: number) {
  const lessons = (await strapi.db
    .query('api::lesson.lesson')
    .findMany({ where: { course: { id: courseId } } })) as Array<{ id: number }>;
  const done = (await strapi.db.query(UID).findMany({
    where: { student: { id: userId }, course: { id: courseId } },
    populate: { lesson: true },
  })) as Array<{ lesson?: { id: number } | null }>;

  return computeProgress(
    lessons.map((l) => l.id),
    done.map((d) => d.lesson?.id).filter((id): id is number => typeof id === 'number'),
  );
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /** POST /api/lesson-completions/complete — body { lessonId } */
  async complete(ctx) {
    const userId = ctx.state.user.id;
    const lessonId =
      ctx.request.body?.lessonId ?? ctx.request.body?.data?.lessonId;
    if (!lessonId || typeof lessonId !== 'string') {
      return ctx.badRequest('lessonId is required');
    }

    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: { documentId: lessonId },
      populate: { course: true },
    });
    if (!lesson?.course) return ctx.notFound('No such lesson');

    const courseId = lesson.course.id;

    const enrolled = await strapi.db.query('api::enrollment.enrollment').findOne({
      where: { dedupeKey: `${userId}:${courseId}` },
    });
    if (!enrolled) {
      return ctx.forbidden('You are not enrolled in this course');
    }

    const dedupeKey = `${userId}:${lesson.id}`;
    const existing = await strapi.db.query(UID).findOne({ where: { dedupeKey } });
    if (!existing) {
      // Progression gate (D-038). `free` → no check. `complete_locked` /
      // `open_locked` → every earlier lesson in course order must already be
      // completed. Enforced here, server-side, so a direct API call can't skip
      // ahead regardless of what the UI shows. Re-marking an already-completed
      // lesson is exempt (handled inside canCompleteLesson).
      const mode = normalizeProgression(lesson.course.lessonProgression);
      if (mode !== 'free') {
        const courseLessons = (await strapi.db
          .query('api::lesson.lesson')
          .findMany({
            where: { course: { id: courseId } },
            orderBy: { order: 'asc' },
          })) as Array<{ id: number; order: number }>;

        const done = (await strapi.db.query(UID).findMany({
          where: { student: { id: userId }, course: { id: courseId } },
          populate: { lesson: true },
        })) as Array<{ lesson?: { id: number } | null }>;

        const doneIds = done
          .map((d) => d.lesson?.id)
          .filter((id): id is number => typeof id === 'number');

        if (
          !canCompleteLesson(
            mode,
            courseLessons.map((l) => ({ id: l.id, order: l.order })),
            doneIds,
            lesson.id,
          )
        ) {
          return ctx.forbidden(
            'Complete the earlier lessons before completing this one.',
          );
        }
      }

      await strapi.db.query(UID).create({
        data: {
          student: userId,
          lesson: lesson.id,
          course: courseId, // from lesson.course, never the request
          completedAt: new Date(),
          dedupeKey,
          publishedAt: new Date(),
        },
      });
    }

    ctx.body = { data: { progress: await progressFor(strapi, userId, courseId) } };
  },

  /** DELETE /api/lesson-completions/:lessonId — un-mark */
  async uncomplete(ctx) {
    const userId = ctx.state.user.id;
    const lessonId = ctx.params.lessonId;

    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: { documentId: lessonId },
      populate: { course: true },
    });
    if (!lesson?.course) return ctx.notFound('No such lesson');

    await strapi.db
      .query(UID)
      .deleteMany({ where: { dedupeKey: `${userId}:${lesson.id}` } });

    ctx.body = {
      data: { progress: await progressFor(strapi, userId, lesson.course.id) },
    };
  },
}));
