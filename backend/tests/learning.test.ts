import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  api,
  login,
  ensureStudent,
  loginAll,
  uniqueTitle,
  nukeCourse,
  AUDIT_PREFIX,
  type TestUser,
} from './helpers/api';

/**
 * The learning journey end to end:
 *
 *   (not enrolled → refused) → enroll → /enrollments/me → /learn
 *   → mark complete → derived progress → uncomplete
 *   → quiz take (no answer key) → submit (graded server-side) → stored review
 *   → D-038 progression enforced server-side
 *   → D-039 unpublished lesson / quiz drop out of every student surface
 *
 * Identity always comes from the token, never the body (RBAC invariant #1).
 */

let T: Record<string, string | null>;
let courseId: string;
let lessonIds: string[] = [];
let quizId: string;

const OWNER = () => T.instructor!;

beforeAll(async () => {
  T = await loginAll();
  expect(T.instructor).toBeTruthy();

  const c = await api('POST', '/api/courses', {
    token: OWNER(),
    body: { data: { title: uniqueTitle('learn'), description: 'learning fixture' } },
  });
  expect(c.status).toBe(200);
  courseId = c.body.data.documentId;

  for (const order of [1, 2, 3]) {
    const l = await api('POST', '/api/lessons', {
      token: OWNER(),
      body: {
        data: {
          title: `${AUDIT_PREFIX} L${order}`,
          order,
          published: true,
          content: `Body of lesson ${order}`,
          videoUrl: '',
          course: courseId,
        },
      },
    });
    expect([200, 201]).toContain(l.status);
    lessonIds.push(l.body.data.documentId);
  }

  const q = await api('POST', '/api/quizzes', {
    token: OWNER(),
    body: {
      data: {
        title: `${AUDIT_PREFIX} quiz`,
        published: true,
        course: courseId,
        questions: [
          {
            prompt: 'Capital of France?',
            options: [
              { text: 'Paris', isCorrect: true },
              { text: 'Berlin', isCorrect: false },
              { text: 'Rome', isCorrect: false },
            ],
          },
          {
            prompt: '2 + 2 = ?',
            options: [
              { text: '3', isCorrect: false },
              { text: '4', isCorrect: true },
            ],
          },
        ],
      },
    },
  });
  expect([200, 201]).toContain(q.status);
  quizId = q.body.data.documentId;

  const pub = await api('POST', `/api/courses/${courseId}/publish`, { token: OWNER() });
  expect(pub.status).toBe(200);
}, 180_000);

afterAll(async () => {
  await api('PUT', `/api/courses/${courseId}`, {
    token: OWNER(),
    body: { data: { lessonProgression: 'free' } },
  });
  await api('DELETE', `/api/quizzes/${quizId}`, { token: OWNER() });
  await nukeCourse(T.cm ?? OWNER(), courseId);
}, 180_000);

// ---------------------------------------------------------------------------

describe('a non-enrolled student is refused every learning action', () => {
  let outsider: TestUser;
  beforeAll(async () => {
    outsider = await ensureStudent('audit-learn-outsider');
  });

  it('GET /learn → 403', async () => {
    const r = await api('GET', `/api/courses/${courseId}/learn`, { token: outsider.token });
    expect(r.status).toBe(403);
  });
  it('complete → 403', async () => {
    const r = await api('POST', '/api/lesson-completions/complete', {
      token: outsider.token,
      body: { lessonId: lessonIds[0] },
    });
    expect(r.status).toBe(403);
  });
  it('quiz take → 403', async () => {
    const r = await api('GET', `/api/quizzes/${quizId}/take`, { token: outsider.token });
    expect(r.status).toBe(403);
  });
  it('quiz submit → 403', async () => {
    const r = await api('POST', `/api/quizzes/${quizId}/submit`, {
      token: outsider.token,
      body: { answers: [] },
    });
    expect(r.status).toBe(403);
  });
});

describe('enroll → learn → complete → progress (free mode)', () => {
  let stu: TestUser;
  beforeAll(async () => {
    stu = await ensureStudent('audit-learn-free');
    // clean slate if a prior run left completions
    for (const lid of lessonIds) {
      await api('DELETE', `/api/lesson-completions/${lid}`, { token: stu.token });
    }
  });

  it('enroll is 200 and idempotent', async () => {
    const first = await api('POST', '/api/enrollments/enroll', {
      token: stu.token,
      body: { courseId },
    });
    expect(first.status).toBe(200);
    const again = await api('POST', '/api/enrollments/enroll', {
      token: stu.token,
      body: { courseId },
    });
    expect(again.status).toBe(200);
    expect(again.body.data.alreadyEnrolled).toBe(true);
  });

  it('GET /enrollments/me lists the course at 0 / 3', async () => {
    const r = await api('GET', '/api/enrollments/me', { token: stu.token });
    expect(r.status).toBe(200);
    const row = r.body.data.find((e: any) => e.course.id === courseId);
    expect(row).toBeTruthy();
    expect(row.progress).toMatchObject({ completed: 0, total: 3, percent: 0 });
  });

  it('GET /learn returns ordered lessons with content and nextLessonId = first', async () => {
    const r = await api('GET', `/api/courses/${courseId}/learn`, { token: stu.token });
    expect(r.status).toBe(200);
    expect(r.body.data.lessons.map((l: any) => l.order)).toEqual([1, 2, 3]);
    expect(r.body.data.lessons[0].content).toBe('Body of lesson 1');
    expect(r.body.data.progress).toMatchObject({ completed: 0, total: 3 });
    expect(r.body.data.nextLessonId).toBe(lessonIds[0]);
  });

  it('marking lesson 1 complete moves progress to 1 / 3 (33%)', async () => {
    const r = await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[0] },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.progress).toMatchObject({ completed: 1, total: 3, percent: 33 });
  });

  it('re-marking the same lesson is idempotent', async () => {
    const r = await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[0] },
    });
    expect(r.status).toBe(200);
    expect(r.body.data.progress.completed).toBe(1);
  });

  it('/enrollments/me reflects the new percentage', async () => {
    const r = await api('GET', '/api/enrollments/me', { token: stu.token });
    const row = r.body.data.find((e: any) => e.course.id === courseId);
    expect(row.progress.percent).toBe(33);
  });

  it('completing the rest reaches 100% and nextLessonId becomes null', async () => {
    await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[1] },
    });
    const last = await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[2] },
    });
    expect(last.body.data.progress).toMatchObject({ completed: 3, total: 3, percent: 100 });

    const learn = await api('GET', `/api/courses/${courseId}/learn`, { token: stu.token });
    expect(learn.body.data.nextLessonId).toBeNull();
  });

  it('un-marking a lesson drops progress back to 67%', async () => {
    const r = await api('DELETE', `/api/lesson-completions/${lessonIds[2]}`, {
      token: stu.token,
    });
    expect(r.status).toBe(200);
    expect(r.body.data.progress).toMatchObject({ completed: 2, total: 3, percent: 67 });
  });

  it('completing a lesson in a course you never enrolled in → 403', async () => {
    const other = await ensureStudent('audit-learn-notenrolled');
    const r = await api('POST', '/api/lesson-completions/complete', {
      token: other.token,
      body: { lessonId: lessonIds[0] },
    });
    expect(r.status).toBe(403);
  });

  it('an invalid lessonId → 404, a missing lessonId → 400', async () => {
    expect(
      (
        await api('POST', '/api/lesson-completions/complete', {
          token: stu.token,
          body: { lessonId: 'does-not-exist' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api('POST', '/api/lesson-completions/complete', {
          token: stu.token,
          body: {},
        })
      ).status,
    ).toBe(400);
  });
});

describe('GET /enrollments/me/dashboard — one-shot aggregate', () => {
  let stu: TestUser;
  beforeAll(async () => {
    stu = await ensureStudent('audit-dashboard');
    for (const lid of lessonIds) {
      await api('DELETE', `/api/lesson-completions/${lid}`, { token: stu.token });
    }
    await api('POST', '/api/enrollments/enroll', {
      token: stu.token,
      body: { courseId },
    });
    await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[0] },
    });
  });

  it('returns enrolments with derived progress, attempts, and a resume card', async () => {
    const r = await api('GET', '/api/enrollments/me/dashboard', { token: stu.token });
    expect(r.status).toBe(200);
    const { enrollments, attempts, resume } = r.body.data;

    const row = enrollments.find((e: any) => e.course.id === courseId);
    expect(row.progress).toMatchObject({ completed: 1, total: 3, percent: 33 });

    expect(Array.isArray(attempts)).toBe(true);

    // in-progress course is the resume pick; next lesson is L2 (L1 done)
    expect(resume.course.id).toBe(courseId);
    expect(resume.progress).toMatchObject({ completed: 1, total: 3 });
    expect(resume.nextLessonTitle).toBe(`${AUDIT_PREFIX} L2`);
  });

  it('matches the single-purpose endpoints it replaces', async () => {
    const [agg, en, at] = await Promise.all([
      api('GET', '/api/enrollments/me/dashboard', { token: stu.token }),
      api('GET', '/api/enrollments/me', { token: stu.token }),
      api('GET', '/api/quiz-attempts/me', { token: stu.token }),
    ]);
    expect(agg.body.data.enrollments.length).toBe(en.body.data.length);
    expect(agg.body.data.attempts.length).toBe(at.body.data.length);
  });

  it('is student-only (instructor → 403)', async () => {
    const r = await api('GET', '/api/enrollments/me/dashboard', { token: T.instructor! });
    expect(r.status).toBe(403);
  });
});

describe('quiz — take (no answer key) → submit (server-graded) → stored review', () => {
  let stu: TestUser;
  beforeAll(async () => {
    stu = await ensureStudent('audit-learn-quiz');
    await api('POST', '/api/enrollments/enroll', { token: stu.token, body: { courseId } });
  });

  it('take never exposes isCorrect', async () => {
    const r = await api('GET', `/api/quizzes/${quizId}/take`, { token: stu.token });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain('isCorrect');
    expect(r.body.data.questions[0].options[0]).not.toHaveProperty('isCorrect');
  });

  it('submit grades on the server — all-correct scores full marks', async () => {
    const take = await api('GET', `/api/quizzes/${quizId}/take`, { token: stu.token });
    const answers = take.body.data.questions.map((q: any) => {
      // pick the right option by its known text (the client can't see isCorrect)
      const right = q.prompt.startsWith('Capital')
        ? q.options.find((o: any) => o.text === 'Paris')
        : q.options.find((o: any) => o.text === '4');
      return { questionId: q.id, selectedOptionId: right.id };
    });
    const sub = await api('POST', `/api/quizzes/${quizId}/submit`, {
      token: stu.token,
      body: { answers },
    });
    expect(sub.status).toBe(200);
    expect(sub.body.data).toMatchObject({ score: 2, totalQuestions: 2 });
  });

  it('a wrong submission scores lower and is still recorded', async () => {
    const take = await api('GET', `/api/quizzes/${quizId}/take`, { token: stu.token });
    const answers = take.body.data.questions.map((q: any) => ({
      questionId: q.id,
      selectedOptionId: q.options[q.options.length - 1].id, // last option
    }));
    const sub = await api('POST', `/api/quizzes/${quizId}/submit`, {
      token: stu.token,
      body: { answers },
    });
    expect(sub.status).toBe(200);
    expect(sub.body.data.score).toBeLessThan(2);
  });

  it('GET /quiz-attempts/me returns the frozen per-question review', async () => {
    const r = await api('GET', '/api/quiz-attempts/me', { token: stu.token });
    expect(r.status).toBe(200);
    const attempt = r.body.data.find((a: any) => a.quiz?.id === quizId);
    expect(attempt).toBeTruthy();
    expect(attempt.answers.length).toBe(2);
    const row = attempt.answers[0];
    expect(row).toHaveProperty('prompt');
    expect(row).toHaveProperty('selectedOptionText');
    expect(row).toHaveProperty('correctOptionText');
  });

  it('answers[] is required on submit', async () => {
    const r = await api('POST', `/api/quizzes/${quizId}/submit`, {
      token: stu.token,
      body: {},
    });
    expect(r.status).toBe(400);
  });
});

describe('identity comes from the token, not the body', () => {
  let a: TestUser;
  let b: TestUser;
  beforeAll(async () => {
    a = await ensureStudent('audit-identity-a');
    b = await ensureStudent('audit-identity-b');
    await api('POST', '/api/enrollments/enroll', { token: a.token, body: { courseId } });
    for (const lid of lessonIds) {
      await api('DELETE', `/api/lesson-completions/${lid}`, { token: a.token });
      await api('DELETE', `/api/lesson-completions/${lid}`, { token: b.token });
    }
  });

  it('a "student" field in the enroll body is ignored — B gains nothing', async () => {
    const before = await api('GET', '/api/enrollments/me', { token: b.token });
    const beforeCount = before.body.data.length;

    await api('POST', '/api/enrollments/enroll', {
      token: a.token,
      body: { courseId, student: b.id, userId: b.id },
    });

    const after = await api('GET', '/api/enrollments/me', { token: b.token });
    expect(after.body.data.length).toBe(beforeCount);
  });

  it('a "student" field in the complete body is ignored — the completion lands on the caller', async () => {
    await api('POST', '/api/lesson-completions/complete', {
      token: a.token,
      body: { lessonId: lessonIds[0], student: b.id, userId: b.id },
    });

    const aMe = await api('GET', '/api/enrollments/me', { token: a.token });
    const aRow = aMe.body.data.find((e: any) => e.course.id === courseId);
    expect(aRow.progress.completed).toBe(1);

    const bMe = await api('GET', '/api/enrollments/me', { token: b.token });
    const bRow = bMe.body.data.find((e: any) => e.course.id === courseId);
    expect(bRow?.progress.completed ?? 0).toBe(0);
  });
});

describe('D-039 — unpublished lesson / quiz leave every student surface', () => {
  let stu: TestUser;
  beforeAll(async () => {
    stu = await ensureStudent('audit-d039');
    await api('POST', '/api/enrollments/enroll', { token: stu.token, body: { courseId } });
  });
  afterAll(async () => {
    await api('POST', `/api/lessons/${lessonIds[1]}/publish`, { token: OWNER() });
    await api('POST', `/api/quizzes/${quizId}/publish`, { token: OWNER() });
  });

  it('unpublishing lesson 2 drops it from /learn and shrinks the denominator to 2', async () => {
    const un = await api('POST', `/api/lessons/${lessonIds[1]}/unpublish`, { token: OWNER() });
    expect(un.status).toBe(200);

    const learn = await api('GET', `/api/courses/${courseId}/learn`, { token: stu.token });
    expect(learn.body.data.lessons.map((l: any) => l.order)).toEqual([1, 3]);
    expect(learn.body.data.progress.total).toBe(2);

    const complete = await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[1] },
    });
    expect(complete.status).toBe(404);
  });

  it('unpublishing the quiz makes take + submit 404, then republish restores', async () => {
    const un = await api('POST', `/api/quizzes/${quizId}/unpublish`, { token: OWNER() });
    expect(un.status).toBe(200);

    expect(
      (await api('GET', `/api/quizzes/${quizId}/take`, { token: stu.token })).status,
    ).toBe(404);
    expect(
      (
        await api('POST', `/api/quizzes/${quizId}/submit`, {
          token: stu.token,
          body: { answers: [] },
        })
      ).status,
    ).toBe(404);

    const re = await api('POST', `/api/quizzes/${quizId}/publish`, { token: OWNER() });
    expect(re.status).toBe(200);
    expect(
      (await api('GET', `/api/quizzes/${quizId}/take`, { token: stu.token })).status,
    ).toBe(200);
  });
});

describe('D-038 — complete_locked is enforced server-side', () => {
  let stu: TestUser;
  beforeAll(async () => {
    await api('PUT', `/api/courses/${courseId}`, {
      token: OWNER(),
      body: { data: { lessonProgression: 'complete_locked' } },
    });
    stu = await ensureStudent('audit-prog-complete');
    await api('POST', '/api/enrollments/enroll', { token: stu.token, body: { courseId } });
    for (const lid of lessonIds) {
      await api('DELETE', `/api/lesson-completions/${lid}`, { token: stu.token });
    }
  });
  afterAll(async () => {
    await api('PUT', `/api/courses/${courseId}`, {
      token: OWNER(),
      body: { data: { lessonProgression: 'free' } },
    });
  });

  it('completing lesson 3 before 1 & 2 is refused (403)', async () => {
    const r = await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[2] },
    });
    expect(r.status).toBe(403);
  });

  it('completing them in order succeeds', async () => {
    for (const lid of lessonIds) {
      const r = await api('POST', '/api/lesson-completions/complete', {
        token: stu.token,
        body: { lessonId: lid },
      });
      expect(r.status).toBe(200);
    }
  });
});

describe('D-038 — open_locked hides ahead content and gates completion', () => {
  let stu: TestUser;
  beforeAll(async () => {
    await api('PUT', `/api/courses/${courseId}`, {
      token: OWNER(),
      body: { data: { lessonProgression: 'open_locked' } },
    });
    stu = await ensureStudent('audit-prog-open');
    await api('POST', '/api/enrollments/enroll', { token: stu.token, body: { courseId } });
    for (const lid of lessonIds) {
      await api('DELETE', `/api/lesson-completions/${lid}`, { token: stu.token });
    }
  });
  afterAll(async () => {
    await api('PUT', `/api/courses/${courseId}`, {
      token: OWNER(),
      body: { data: { lessonProgression: 'free' } },
    });
  });

  it('/learn locks later lessons and withholds their body', async () => {
    const r = await api('GET', `/api/courses/${courseId}/learn`, { token: stu.token });
    expect(r.status).toBe(200);
    const [first, second] = r.body.data.lessons;
    expect(first.locked).toBe(false);
    expect(first.content).toBe('Body of lesson 1');
    expect(second.locked).toBe(true);
    expect(second.content).toBe('');
  });

  it('a direct complete of a locked lesson → 403', async () => {
    const r = await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[1] },
    });
    expect(r.status).toBe(403);
  });

  it('completing the first unlocks the second', async () => {
    await api('POST', '/api/lesson-completions/complete', {
      token: stu.token,
      body: { lessonId: lessonIds[0] },
    });
    const r = await api('GET', `/api/courses/${courseId}/learn`, { token: stu.token });
    const second = r.body.data.lessons[1];
    expect(second.locked).toBe(false);
    expect(second.content).toBe('Body of lesson 2');
  });
});

describe('enrolment respects course visibility (D-039)', () => {
  let stu: TestUser;
  beforeAll(async () => {
    stu = await ensureStudent('audit-enroll-visibility');
  });
  afterAll(async () => {
    await api('POST', `/api/courses/${courseId}/publish`, { token: OWNER() });
  });

  it('a fresh student cannot self-enrol once the course is enrolled_only → 404', async () => {
    await api('POST', `/api/courses/${courseId}/unpublish`, {
      token: OWNER(),
      body: { mode: 'enrolled_only' },
    });
    const r = await api('POST', '/api/enrollments/enroll', {
      token: stu.token,
      body: { courseId },
    });
    expect(r.status).toBe(404);
  });

  it('a non-existent courseId → 404, a missing courseId → 400', async () => {
    expect(
      (
        await api('POST', '/api/enrollments/enroll', {
          token: stu.token,
          body: { courseId: 'nope-nope-nope' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api('POST', '/api/enrollments/enroll', {
          token: stu.token,
          body: {},
        })
      ).status,
    ).toBe(400);
  });
});
