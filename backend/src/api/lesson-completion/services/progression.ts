/**
 * Per-course lesson progression rules. Like `progress.ts` these are PURE
 * functions — ordered lesson data in, plain decisions out, no `ctx`, no Strapi.
 * That is what makes progression.test.ts possible without booting Strapi and
 * what lets the same logic run identically in the `/learn` and `complete`
 * controllers.
 *
 * Three modes, stored on `course.lessonProgression` (D-038):
 *
 *   - `free`            — no restriction. View and complete lessons in any order.
 *   - `complete_locked` — every lesson is viewable, but a lesson can only be
 *                         *completed* once every earlier lesson is completed.
 *   - `open_locked`     — a lesson cannot even be *opened* until every earlier
 *                         lesson is completed (completion is gated too).
 *
 * "Earlier" is the course's own lesson order: `order ASC, id ASC` — the same
 * ordering the viewer and `nextLessonId` use. Gaps in `order` are fine; the
 * relative sequence is all that matters, so reordering or inserting lessons is
 * handled automatically.
 */

export type ProgressionMode = 'free' | 'complete_locked' | 'open_locked';

export const PROGRESSION_MODES: ProgressionMode[] = [
  'free',
  'complete_locked',
  'open_locked',
];

export const DEFAULT_PROGRESSION: ProgressionMode = 'free';

/** Coerce any stored / incoming value to a known mode. Unknown / null → default,
 *  so an existing course with no value set behaves as `free`. */
export function normalizeProgression(value: unknown): ProgressionMode {
  return PROGRESSION_MODES.includes(value as ProgressionMode)
    ? (value as ProgressionMode)
    : DEFAULT_PROGRESSION;
}

export type LessonOrderRef = { id: number | string; order: number };

/** Canonical course order: `order ASC`, then `id ASC` as a stable tiebreaker. */
function sortLessons<T extends LessonOrderRef>(lessons: T[]): T[] {
  return [...lessons].sort(
    (a, b) => a.order - b.order || String(a.id).localeCompare(String(b.id)),
  );
}

/**
 * The lessons that must be completed before `targetId` — every lesson strictly
 * earlier in course order. The first lesson (index 0) has none; an unknown
 * `targetId` also yields `[]` (nothing to block on — the caller handles "no such
 * lesson" separately).
 */
export function requiredPriorLessonIds(
  lessons: LessonOrderRef[],
  targetId: number | string,
): Array<number | string> {
  const ordered = sortLessons(lessons);
  const idx = ordered.findIndex((l) => String(l.id) === String(targetId));
  if (idx <= 0) return [];
  return ordered.slice(0, idx).map((l) => l.id);
}

/** Are all of `targetId`'s required prior lessons in the completed set? */
export function priorLessonsComplete(
  lessons: LessonOrderRef[],
  completedLessonIds: Array<number | string>,
  targetId: number | string,
): boolean {
  const done = new Set(completedLessonIds.map(String));
  return requiredPriorLessonIds(lessons, targetId).every((id) =>
    done.has(String(id)),
  );
}

/**
 * May this student mark `targetId` complete right now?
 * `free` → always. `complete_locked` / `open_locked` → only once every earlier
 * lesson is complete. An already-completed lesson is always allowed (idempotent
 * re-mark, and un-mark then re-mark).
 */
export function canCompleteLesson(
  mode: ProgressionMode,
  lessons: LessonOrderRef[],
  completedLessonIds: Array<number | string>,
  targetId: number | string,
): boolean {
  if (mode === 'free') return true;
  const done = new Set(completedLessonIds.map(String));
  if (done.has(String(targetId))) return true;
  return priorLessonsComplete(lessons, completedLessonIds, targetId);
}

/**
 * May this student open / view `targetId` right now?
 * Only `open_locked` restricts viewing; the other two modes never hide a lesson.
 * A completed lesson stays open even if the course was later reordered.
 */
export function canOpenLesson(
  mode: ProgressionMode,
  lessons: LessonOrderRef[],
  completedLessonIds: Array<number | string>,
  targetId: number | string,
): boolean {
  if (mode !== 'open_locked') return true;
  const done = new Set(completedLessonIds.map(String));
  if (done.has(String(targetId))) return true;
  return priorLessonsComplete(lessons, completedLessonIds, targetId);
}

export type LessonGateStatus =
  | 'completed' // student has completed it
  | 'available' // open and completable now
  | 'cannot_complete' // viewable, but earlier lessons block completion (complete_locked)
  | 'locked'; // cannot be opened yet (open_locked)

export type LessonGate = {
  id: number | string;
  status: LessonGateStatus;
  /** convenience booleans for the client / payload shaping */
  locked: boolean;
  canComplete: boolean;
  /** short human explanation when the lesson is gated, else null */
  hint: string | null;
};

const HINTS = {
  cannot_complete: 'Complete the earlier lessons before completing this one.',
  locked: 'Complete the earlier lessons to unlock this one.',
} as const;

/**
 * One pass over the ordered lessons, returning a gate decision per lesson. Used
 * by `/learn` to annotate the payload and by the viewer to render Available /
 * Completed / Locked / Cannot complete yet.
 */
export function lessonGates(
  mode: ProgressionMode,
  lessons: LessonOrderRef[],
  completedLessonIds: Array<number | string>,
): LessonGate[] {
  const done = new Set(completedLessonIds.map(String));
  const ordered = sortLessons(lessons);
  let priorAllDone = true; // everything strictly before the current index

  return ordered.map((lesson) => {
    const isDone = done.has(String(lesson.id));
    let status: LessonGateStatus;

    if (isDone) {
      status = 'completed';
    } else if (mode === 'open_locked' && !priorAllDone) {
      status = 'locked';
    } else if (mode === 'complete_locked' && !priorAllDone) {
      status = 'cannot_complete';
    } else {
      status = 'available';
    }

    if (!isDone) priorAllDone = false;

    return {
      id: lesson.id,
      status,
      locked: status === 'locked',
      canComplete: status === 'available' || status === 'completed',
      hint:
        status === 'cannot_complete'
          ? HINTS.cannot_complete
          : status === 'locked'
            ? HINTS.locked
            : null,
    };
  });
}
