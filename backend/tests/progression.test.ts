import { describe, it, expect } from 'vitest';
import {
  normalizeProgression,
  requiredPriorLessonIds,
  priorLessonsComplete,
  canCompleteLesson,
  canOpenLesson,
  lessonGates,
  DEFAULT_PROGRESSION,
} from '../src/api/lesson-completion/services/progression';

/**
 * Pure-function tests for the D-038 progression rules — no Strapi boot. The
 * `/learn` and `complete` controllers both call this exact logic, so these
 * cases stand in for the server-side enforcement.
 */

// order gaps are allowed (see DATA_MODEL.md) — the relative sequence is used.
const LESSONS = [
  { id: 1, order: 1 },
  { id: 2, order: 3 },
  { id: 3, order: 5 },
  { id: 4, order: 6 },
];

describe('normalizeProgression', () => {
  it('passes through the three known modes', () => {
    expect(normalizeProgression('free')).toBe('free');
    expect(normalizeProgression('complete_locked')).toBe('complete_locked');
    expect(normalizeProgression('open_locked')).toBe('open_locked');
  });

  it('unknown / null / undefined → default (free) so existing courses are safe', () => {
    expect(normalizeProgression(null)).toBe(DEFAULT_PROGRESSION);
    expect(normalizeProgression(undefined)).toBe('free');
    expect(normalizeProgression('')).toBe('free');
    expect(normalizeProgression('sequential')).toBe('free');
  });
});

describe('requiredPriorLessonIds', () => {
  it('first lesson has no prerequisites', () => {
    expect(requiredPriorLessonIds(LESSONS, 1)).toEqual([]);
  });

  it('a middle lesson requires every earlier lesson in course order', () => {
    expect(requiredPriorLessonIds(LESSONS, 3)).toEqual([1, 2]);
  });

  it('order is by `order` then `id`, not array position', () => {
    const shuffled = [
      { id: 4, order: 6 },
      { id: 1, order: 1 },
      { id: 3, order: 5 },
      { id: 2, order: 3 },
    ];
    expect(requiredPriorLessonIds(shuffled, 4)).toEqual([1, 2, 3]);
  });

  it('unknown lesson id → [] (caller handles "no such lesson")', () => {
    expect(requiredPriorLessonIds(LESSONS, 999)).toEqual([]);
  });

  it('empty course → []', () => {
    expect(requiredPriorLessonIds([], 1)).toEqual([]);
  });
});

describe('priorLessonsComplete', () => {
  it('true when every earlier lesson is done', () => {
    expect(priorLessonsComplete(LESSONS, [1, 2], 3)).toBe(true);
  });
  it('false when a gap exists', () => {
    expect(priorLessonsComplete(LESSONS, [1], 3)).toBe(false);
  });
  it('true for the first lesson regardless of completions', () => {
    expect(priorLessonsComplete(LESSONS, [], 1)).toBe(true);
  });
});

describe('canCompleteLesson', () => {
  it('free — any lesson, any order', () => {
    expect(canCompleteLesson('free', LESSONS, [], 4)).toBe(true);
  });

  it('complete_locked — first lesson never needs a predecessor', () => {
    expect(canCompleteLesson('complete_locked', LESSONS, [], 1)).toBe(true);
  });

  it('complete_locked — blocked until earlier lessons are done', () => {
    expect(canCompleteLesson('complete_locked', LESSONS, [1], 3)).toBe(false);
    expect(canCompleteLesson('complete_locked', LESSONS, [1, 2], 3)).toBe(true);
  });

  it('open_locked — completion is gated the same way', () => {
    expect(canOpenLesson('open_locked', LESSONS, [1], 3)).toBe(false);
    expect(canCompleteLesson('open_locked', LESSONS, [1], 3)).toBe(false);
    expect(canCompleteLesson('open_locked', LESSONS, [1, 2], 3)).toBe(true);
  });

  it('sequential completion end to end (complete_locked)', () => {
    const done: number[] = [];
    for (const l of LESSONS) {
      expect(canCompleteLesson('complete_locked', LESSONS, done, l.id)).toBe(true);
      done.push(l.id);
    }
  });

  it('an already-completed lesson stays completable (idempotent re-mark)', () => {
    // lesson 3 done, but lesson 2 was later un-marked — re-marking 3 still allowed
    expect(canCompleteLesson('complete_locked', LESSONS, [1, 3], 3)).toBe(true);
  });

  it('reordering lessons re-evaluates prerequisites', () => {
    // lesson 4 moved to the front; now it needs nothing
    const reordered = [
      { id: 4, order: 0 },
      { id: 1, order: 1 },
      { id: 2, order: 3 },
      { id: 3, order: 5 },
    ];
    expect(canCompleteLesson('complete_locked', reordered, [], 4)).toBe(true);
    expect(canCompleteLesson('complete_locked', reordered, [], 1)).toBe(false);
  });

  it('empty course — nothing to complete, no crash', () => {
    expect(canCompleteLesson('complete_locked', [], [], 1)).toBe(true);
  });
});

describe('canOpenLesson', () => {
  it('free / complete_locked never restrict opening', () => {
    expect(canOpenLesson('free', LESSONS, [], 4)).toBe(true);
    expect(canOpenLesson('complete_locked', LESSONS, [], 4)).toBe(true);
  });

  it('open_locked — later lessons cannot be opened until earlier ones are done', () => {
    expect(canOpenLesson('open_locked', LESSONS, [], 1)).toBe(true); // first
    expect(canOpenLesson('open_locked', LESSONS, [], 2)).toBe(false);
    expect(canOpenLesson('open_locked', LESSONS, [1], 2)).toBe(true);
  });

  it('open_locked — a completed lesson stays open even after a reorder', () => {
    expect(canOpenLesson('open_locked', LESSONS, [3], 3)).toBe(true);
  });
});

describe('lessonGates — per-lesson UI status', () => {
  it('free: everything available, done ones completed', () => {
    const g = lessonGates('free', LESSONS, [1]);
    expect(g.map((x) => x.status)).toEqual([
      'completed',
      'available',
      'available',
      'available',
    ]);
  });

  it('complete_locked: viewable but "cannot_complete" past the first gap', () => {
    const g = lessonGates('complete_locked', LESSONS, [1]);
    expect(g.map((x) => x.status)).toEqual([
      'completed',
      'available', // next up — prior all done
      'cannot_complete',
      'cannot_complete',
    ]);
    expect(g[2].locked).toBe(false); // still openable
    expect(g[2].canComplete).toBe(false);
    expect(g[2].hint).toMatch(/earlier lessons/i);
  });

  it('open_locked: later lessons are "locked"', () => {
    const g = lessonGates('open_locked', LESSONS, [1]);
    expect(g.map((x) => x.status)).toEqual([
      'completed',
      'available',
      'locked',
      'locked',
    ]);
    expect(g[2].locked).toBe(true);
    expect(g[3].hint).toMatch(/unlock/i);
  });

  it('open_locked: completing in order unlocks the next lesson only', () => {
    const g = lessonGates('open_locked', LESSONS, [1, 2]);
    expect(g.map((x) => x.status)).toEqual([
      'completed',
      'completed',
      'available',
      'locked',
    ]);
  });

  it('empty course → no gates, no crash', () => {
    expect(lessonGates('open_locked', [], [])).toEqual([]);
  });

  it('a stale completion for a removed lesson does not widen access', () => {
    // lesson 99 isn't in the course; lesson 2 still locked under open_locked
    const g = lessonGates('open_locked', LESSONS, [99]);
    expect(g[0].status).toBe('available'); // first lesson
    expect(g[1].status).toBe('locked');
  });
});
