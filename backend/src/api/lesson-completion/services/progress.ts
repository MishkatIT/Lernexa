/**
 * Progress is derived, never stored (D-003). These are PURE functions — plain
 * arrays in, plain numbers out, no `ctx`, no Strapi. That is what makes
 * progress.test.ts possible without booting Strapi, and it's the refactor the
 * interview asks about.
 */

export type ProgressResult = {
  completed: number;
  total: number;
  percent: number;
};

/**
 * One student, one course.
 *
 * @param lessonIds       every lesson id currently in the course
 * @param completedLessonIds  lesson ids this student has completed
 *
 * Only completions that point at a lesson still in the course count — a deleted
 * lesson can't push `completed` above `total`. total === 0 → 0%, no divide by
 * zero. A 5/5 student drops to 5/6 when a lesson is added: correct, the course
 * changed.
 */
export function computeProgress(
  lessonIds: Array<number | string>,
  completedLessonIds: Array<number | string>,
): ProgressResult {
  const inCourse = new Set(lessonIds.map(String));
  const total = inCourse.size;

  const completed = new Set(
    completedLessonIds.map(String).filter((id) => inCourse.has(id)),
  ).size;

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

/**
 * Every student in one course, in memory. The caller does exactly two queries —
 * the course's lesson ids, and all completions for the course (student id +
 * lesson id) — then hands both here. No query in a loop (PERFORMANCE.md N+1 #1:
 * 2 queries instead of 1 + 2N).
 */
export function computeProgressForCourse(
  lessonIds: Array<number | string>,
  completions: Array<{ studentId: number | string; lessonId: number | string }>,
): Map<string, ProgressResult> {
  const byStudent = new Map<string, Array<number | string>>();
  for (const { studentId, lessonId } of completions) {
    const key = String(studentId);
    const list = byStudent.get(key) ?? [];
    list.push(lessonId);
    byStudent.set(key, list);
  }

  const out = new Map<string, ProgressResult>();
  for (const [studentId, done] of byStudent) {
    out.set(studentId, computeProgress(lessonIds, done));
  }
  return out;
}

/** The next lesson to do: lowest `order` (then id) that isn't completed. */
export function nextLessonId(
  lessons: Array<{ id: number | string; order: number }>,
  completedLessonIds: Array<number | string>,
): number | string | null {
  const done = new Set(completedLessonIds.map(String));
  const ordered = [...lessons].sort(
    (a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)),
  );
  const next = ordered.find((l) => !done.has(String(l.id)));
  return next ? next.id : null;
}
