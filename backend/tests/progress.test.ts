import { describe, it, expect } from 'vitest';
import {
  computeProgress,
  computeProgressForCourse,
  nextLessonId,
} from '../src/api/lesson-completion/services/progress';

describe('computeProgress', () => {
  it('0 lessons → 0%, no divide by zero', () => {
    expect(computeProgress([], [])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('0 completed', () => {
    expect(computeProgress([1, 2, 3, 4], [])).toEqual({
      completed: 0,
      total: 4,
      percent: 0,
    });
  });

  it('half done rounds to 50%', () => {
    expect(computeProgress([1, 2, 3, 4], [1, 2])).toEqual({
      completed: 2,
      total: 4,
      percent: 50,
    });
  });

  it('all completed → 100%', () => {
    expect(computeProgress([1, 2, 3], [3, 1, 2])).toEqual({
      completed: 3,
      total: 3,
      percent: 100,
    });
  });

  it('a completion for a lesson no longer in the course does not count', () => {
    // lesson 4 was deleted; the stale completion must not push completed > total
    expect(computeProgress([1, 2, 3], [1, 2, 4])).toEqual({
      completed: 2,
      total: 3,
      percent: 67,
    });
  });

  it('adding a 6th lesson drops a 5/5 student to 83%', () => {
    expect(computeProgress([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5])).toEqual({
      completed: 5,
      total: 6,
      percent: 83,
    });
  });

  it('duplicate completions are counted once', () => {
    expect(computeProgress([1, 2], [1, 1, 1]).completed).toBe(1);
  });

  it('works with string ids', () => {
    expect(computeProgress(['a', 'b'], ['a']).percent).toBe(50);
  });
});

describe('computeProgressForCourse', () => {
  it('one pass, one result per student who has any completion', () => {
    const lessons = [10, 11, 12, 13];
    const completions = [
      { studentId: 1, lessonId: 10 },
      { studentId: 1, lessonId: 11 },
      { studentId: 2, lessonId: 10 },
      { studentId: 2, lessonId: 11 },
      { studentId: 2, lessonId: 12 },
      { studentId: 2, lessonId: 13 },
    ];
    const out = computeProgressForCourse(lessons, completions);
    expect(out.get('1')).toEqual({ completed: 2, total: 4, percent: 50 });
    expect(out.get('2')).toEqual({ completed: 4, total: 4, percent: 100 });
    expect(out.has('3')).toBe(false);
  });

  it('ignores completions for lessons removed from the course', () => {
    const out = computeProgressForCourse(
      [10, 11],
      [
        { studentId: 7, lessonId: 10 },
        { studentId: 7, lessonId: 99 },
      ],
    );
    expect(out.get('7')).toEqual({ completed: 1, total: 2, percent: 50 });
  });
});

describe('nextLessonId', () => {
  const lessons = [
    { id: 3, order: 2 },
    { id: 1, order: 1 },
    { id: 2, order: 3 },
  ];

  it('lowest order not yet completed', () => {
    expect(nextLessonId(lessons, [1])).toBe(3);
  });

  it('first lesson when nothing done', () => {
    expect(nextLessonId(lessons, [])).toBe(1);
  });

  it('null when everything is done', () => {
    expect(nextLessonId(lessons, [1, 2, 3])).toBeNull();
  });
});
