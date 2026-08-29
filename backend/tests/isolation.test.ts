import { describe, it, expect, beforeAll } from 'vitest';
import { api, login, ensureStudent, loginAll, type TestUser } from './helpers/api';

/**
 * Cross-tenant / IDOR isolation, asserted on the RESPONSE BODY — the layer-4
 * forced-filter checks that a status code alone (200 either way) can't show.
 * Complements permission-matrix.test.ts, which covers the status codes.
 *
 * RBAC.md "IDOR / isolation matrix":
 *   - Student X reads Student Y's enrollments via `filters`      → own rows only
 *   - Student X reads Student Y's quiz attempts via `filters`    → own rows only
 *   - Instructor A reads Instructor B's quiz / lessons by course → 0 rows
 *   - Anonymous / student lists blog drafts                      → 0 draft rows
 *   - `GET /api/courses/:id` for a draft course                  → 404
 */

let T: Record<string, string | null>;
let studentA: TestUser;
let studentB: TestUser;

beforeAll(async () => {
  T = await loginAll();
  studentA = await ensureStudent('audit-iso-a');
  studentB = await ensureStudent('audit-iso-b');
}, 180_000);

describe('enrollment list scoping — a filter cannot widen it (D-005)', () => {
  it('GET /api/enrollments/me returns the same rows with or without a foreign student filter', async () => {
    const plain = await api('GET', '/api/enrollments/me', { token: studentA.token });
    expect(plain.status).toBe(200);

    const spoofed = await api(
      'GET',
      `/api/enrollments/me?filters[student][id][$eq]=${studentB.id}&filters[student][id][$eq]=1`,
      { token: studentA.token },
    );
    expect(spoofed.status).toBe(200);
    expect(spoofed.body.data.length).toBe(plain.body.data.length);
  });
});

describe('quiz-attempt list scoping', () => {
  it('GET /api/quiz-attempts/me ignores a foreign student filter', async () => {
    const plain = await api('GET', '/api/quiz-attempts/me', { token: studentA.token });
    const spoofed = await api(
      'GET',
      `/api/quiz-attempts/me?filters[student][id][$eq]=${studentB.id}`,
      { token: studentA.token },
    );
    expect(plain.status).toBe(200);
    expect(spoofed.status).toBe(200);
    expect(spoofed.body.data.length).toBe(plain.body.data.length);
  });
});

describe('instructor answer-key isolation (layer 4 + is-quiz-owner)', () => {
  it("instructor2 sees zero of instructor1's quizzes when filtering by their course", async () => {
    // find a course owned by instructor1 via their own manage list
    const mine = await api('GET', '/api/courses?pagination[pageSize]=100', {
      token: T.instructor!,
    });
    const course = mine.body.data[0];
    expect(course, 'instructor1 should own at least one course in the seed').toBeTruthy();

    const cross = await api(
      'GET',
      `/api/quizzes?filters[course][documentId][$eq]=${course.documentId}&pagination[pageSize]=50`,
      { token: T.instructor2! },
    );
    expect(cross.status).toBe(200);
    expect(cross.body.data).toHaveLength(0);
  });

  it("instructor2 sees zero of instructor1's lessons when filtering by their course", async () => {
    const mine = await api('GET', '/api/courses?pagination[pageSize]=100', {
      token: T.instructor!,
    });
    const course = mine.body.data[0];
    const cross = await api(
      'GET',
      `/api/lessons?filters[course][documentId][$eq]=${course.documentId}&pagination[pageSize]=50`,
      { token: T.instructor2! },
    );
    expect(cross.status).toBe(200);
    expect(cross.body.data).toHaveLength(0);
  });
});

describe('blog drafts never leak to non-managers', () => {
  it('the anonymous feed contains only published posts', async () => {
    const r = await api('GET', '/api/blog-posts?pagination[pageSize]=100', {});
    expect(r.status).toBe(200);
    expect(r.body.data.every((p: any) => p.publishedAt)).toBe(true);
  });

  it('a student passing ?status=draft still only gets published posts', async () => {
    const r = await api('GET', '/api/blog-posts?status=draft&pagination[pageSize]=100', {
      token: studentA.token,
    });
    expect(r.status).toBe(200);
    expect(r.body.data.every((p: any) => p.publishedAt)).toBe(true);
  });
});

describe('a draft course cannot be probed by id', () => {
  let draftId: string;
  beforeAll(async () => {
    const c = await api('POST', '/api/courses', {
      token: T.cm!,
      body: { data: { title: `__audit__ iso-draft ${Date.now().toString(36)}` } },
    });
    draftId = c.body.data.documentId;
  });

  it('findOne is 404 for anon and for a student, 200 for a manager', async () => {
    expect((await api('GET', `/api/courses/${draftId}`, {})).status).toBe(404);
    expect(
      (await api('GET', `/api/courses/${draftId}`, { token: studentA.token })).status,
    ).toBe(404);
    expect((await api('GET', `/api/courses/${draftId}`, { token: T.cm! })).status).toBe(200);
  });

  it('cleanup', async () => {
    const r = await api('DELETE', `/api/courses/${draftId}`, { token: T.cm! });
    expect([204, 200]).toContain(r.status);
  });
});

describe('student-progress + roster are owner-scoped', () => {
  it("a non-owner instructor is 403 on another instructor's student-progress", async () => {
    const mine = await api('GET', '/api/courses?pagination[pageSize]=100', {
      token: T.instructor!,
    });
    const course = mine.body.data[0];
    const r = await api('GET', `/api/courses/${course.documentId}/student-progress`, {
      token: T.instructor2!,
    });
    expect(r.status).toBe(403);
    const own = await api('GET', `/api/courses/${course.documentId}/student-progress`, {
      token: T.instructor!,
    });
    expect(own.status).toBe(200);
  });

  it("a non-owner instructor cannot add to another instructor's roster", async () => {
    const mine = await api('GET', '/api/courses?pagination[pageSize]=100', {
      token: T.instructor!,
    });
    const course = mine.body.data[0];
    const r = await api('POST', `/api/courses/${course.documentId}/enrollments`, {
      token: T.instructor2!,
      body: { emails: ['ghost@lernexa.dev'] },
    });
    expect(r.status).toBe(403);
  });
});
