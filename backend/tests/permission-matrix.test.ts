import { describe, it, expect, beforeAll } from 'vitest';

/**
 * The RBAC matrix (RBAC.md) encoded as data and asserted against a RUNNING
 * Strapi. Point it at a live instance:
 *
 *   TEST_API_URL=http://localhost:1337 npm test          (default: localhost)
 *   TEST_API_URL=https://…up.railway.app npm test         (against production)
 *
 * Requires the seed to have run (npm run seed) — it logs in as the seeded
 * accounts, password Lernexa123!.
 */
const BASE = process.env.TEST_API_URL ?? 'http://localhost:1337';
const PASSWORD = 'Lernexa123!';

const ACCOUNTS: Record<string, string | null> = {
  admin: 'admin@lernexa.test',
  'content-manager': 'cm@lernexa.test',
  instructor: 'instructor@lernexa.test',
  instructor2: 'instructor2@lernexa.test',
  student: 'student@lernexa.test',
  blocked: 'blocked@lernexa.test',
  anon: null,
};

const tokens: Record<string, string | null> = {};
let ownCourseId = '';
let otherCourseId = '';
let quizId = '';
let ownLessonId = '';

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: PASSWORD }),
  });
  if (!res.ok) return null;
  return (await res.json()).jwt as string;
}

async function call(
  role: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<number> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokens[role];
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}

beforeAll(async () => {
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    tokens[role] = email ? await login(email) : null;
  }

  // Resolve a course owned by `instructor` and one owned by `instructor2`.
  const list = await (await fetch(`${BASE}/api/courses?pagination[pageSize]=50`)).json();
  const react = list.data.find((c: { title: string }) => c.title === 'React Fundamentals');
  const api = list.data.find((c: { title: string }) => c.title === 'API Design Basics');
  ownCourseId = react?.documentId ?? '';
  otherCourseId = api?.documentId ?? '';

  // A quiz + a lesson that belong to `instructor`'s own course — the fixtures
  // the cross-instructor read cases probe.
  const quizzes = await (
    await fetch(
      `${BASE}/api/quizzes?filters[course][documentId][$eq]=${ownCourseId}&pagination[pageSize]=1`,
      { headers: { Authorization: `Bearer ${tokens.instructor}` } },
    )
  ).json();
  quizId = quizzes.data?.[0]?.documentId ?? '';

  const lessons = await (
    await fetch(
      `${BASE}/api/lessons?filters[course][documentId][$eq]=${ownCourseId}&pagination[pageSize]=1`,
      { headers: { Authorization: `Bearer ${tokens.instructor}` } },
    )
  ).json();
  ownLessonId = lessons.data?.[0]?.documentId ?? '';
}, 30_000);

type Case = {
  role: string;
  method: string;
  path: () => string;
  body?: unknown;
  expect: number | number[];
};

const CASES: Case[] = [
  // public reads
  { role: 'anon', method: 'GET', path: () => '/api/courses', expect: 200 },
  { role: 'anon', method: 'GET', path: () => '/api/blog-posts', expect: 200 },

  // course writes
  { role: 'student', method: 'POST', path: () => '/api/courses', body: { data: { title: 'x' } }, expect: 403 },
  { role: 'anon', method: 'POST', path: () => '/api/courses', body: { data: { title: 'x' } }, expect: 403 },
  { role: 'instructor', method: 'PUT', path: () => `/api/courses/${otherCourseId}`, body: { data: { title: 'x' } }, expect: 403 },
  { role: 'instructor', method: 'PUT', path: () => `/api/courses/${ownCourseId}`, body: { data: { description: 'ok' } }, expect: 200 },
  { role: 'content-manager', method: 'PUT', path: () => `/api/courses/${otherCourseId}`, body: { data: { description: 'cm can' } }, expect: 200 },

  // lesson progression setting (D-038) — only the owner / a manager may change it
  { role: 'student', method: 'PUT', path: () => `/api/courses/${ownCourseId}`, body: { data: { lessonProgression: 'open_locked' } }, expect: 403 },
  { role: 'anon', method: 'PUT', path: () => `/api/courses/${ownCourseId}`, body: { data: { lessonProgression: 'open_locked' } }, expect: 403 },
  { role: 'instructor2', method: 'PUT', path: () => `/api/courses/${ownCourseId}`, body: { data: { lessonProgression: 'open_locked' } }, expect: 403 },
  { role: 'instructor', method: 'PUT', path: () => `/api/courses/${ownCourseId}`, body: { data: { lessonProgression: 'complete_locked' } }, expect: 200 },
  { role: 'instructor', method: 'PUT', path: () => `/api/courses/${ownCourseId}`, body: { data: { lessonProgression: 'not-a-mode' } }, expect: 400 },
  { role: 'admin', method: 'PUT', path: () => `/api/courses/${ownCourseId}`, body: { data: { lessonProgression: 'free' } }, expect: 200 },

  // quiz isolation — reads are manager-only AND owner-scoped for instructors
  { role: 'student', method: 'GET', path: () => `/api/quizzes/${quizId}`, expect: 403 },
  { role: 'anon', method: 'GET', path: () => '/api/quizzes', expect: [401, 403] },
  { role: 'student', method: 'GET', path: () => '/api/quizzes', expect: 403 },
  { role: 'instructor2', method: 'GET', path: () => `/api/quizzes/${quizId}`, expect: 403 },
  { role: 'instructor', method: 'GET', path: () => `/api/quizzes/${quizId}`, expect: 200 },
  { role: 'instructor2', method: 'PUT', path: () => `/api/quizzes/${quizId}`, body: { data: { title: 'x' } }, expect: 403 },

  // lesson isolation — same shape: manager-only, owner-scoped for instructors
  { role: 'anon', method: 'GET', path: () => '/api/lessons', expect: [401, 403] },
  { role: 'student', method: 'GET', path: () => '/api/lessons', expect: 403 },
  { role: 'instructor2', method: 'GET', path: () => `/api/lessons/${ownLessonId}`, expect: 403 },
  { role: 'instructor', method: 'GET', path: () => `/api/lessons/${ownLessonId}`, expect: 200 },

  // enrollment / learning is student-only
  { role: 'instructor', method: 'GET', path: () => '/api/enrollments/me', expect: 403 },
  { role: 'student', method: 'GET', path: () => '/api/enrollments/me', expect: 200 },

  // blog writes
  { role: 'instructor', method: 'POST', path: () => '/api/blog-posts', body: { data: { title: 'x' } }, expect: 403 },
  { role: 'content-manager', method: 'GET', path: () => '/api/blog-posts?status=draft', expect: 200 },

  // platform is admin-only
  { role: 'content-manager', method: 'GET', path: () => '/api/platform/stats', expect: 403 },
  { role: 'instructor', method: 'GET', path: () => '/api/platform/users', expect: 403 },
  { role: 'admin', method: 'GET', path: () => '/api/platform/stats', expect: 200 },

  // settings
  { role: 'content-manager', method: 'PUT', path: () => '/api/site-setting', body: { data: { siteName: 'x' } }, expect: 403 },
  { role: 'anon', method: 'GET', path: () => '/api/site-setting', expect: 200 },

  // account state — the seeded blocked user can't obtain a token at all, so
  // these assert "no usable session". The blocked-token *replay* (403
  // ACCOUNT_BLOCKED) is covered by scripts/verify-auth.sh, which can mint a
  // token before blocking.
  { role: 'blocked', method: 'GET', path: () => '/api/enrollments/me', expect: [401, 403] },
  { role: 'blocked', method: 'GET', path: () => '/api/users/me', expect: [401, 403] },
];

describe(`permission matrix @ ${BASE}`, () => {
  it('seeded accounts logged in (except the blocked one, which cannot)', () => {
    expect(tokens.admin).toBeTruthy();
    expect(tokens.instructor).toBeTruthy();
    expect(tokens.student).toBeTruthy();
    expect(tokens.blocked).toBeNull(); // login callback rejects blocked users
  });

  for (const c of CASES) {
    const label = `${c.role} ${c.method} ${c.path()
      .replace(ownCourseId, '{own}')
      .replace(otherCourseId, '{other}')
      .replace(quizId, '{quiz}')}`;
    it(`${label} → ${Array.isArray(c.expect) ? c.expect.join('/') : c.expect}`, async () => {
      const status = await call(c.role, c.method, c.path(), c.body);
      if (Array.isArray(c.expect)) expect(c.expect).toContain(status);
      else expect(status).toBe(c.expect);
    });
  }

  // Status codes can't show list scoping (200 either way) — assert the body.
  // instructor2 must not see instructor1's quiz / lessons even when they ask
  // for that course by documentId.
  const asJson = async (role: string, path: string) => {
    const headers: Record<string, string> = {};
    if (tokens[role]) headers.Authorization = `Bearer ${tokens[role]}`;
    return (await fetch(`${BASE}${path}`, { headers })).json();
  };

  it('instructor2 GET /api/quizzes?filters[course]={own} → empty (owner scope)', async () => {
    const body = await asJson(
      'instructor2',
      `/api/quizzes?filters[course][documentId][$eq]=${ownCourseId}&pagination[pageSize]=50`,
    );
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it('instructor2 GET /api/lessons?filters[course]={own} → empty (owner scope)', async () => {
    const body = await asJson(
      'instructor2',
      `/api/lessons?filters[course][documentId][$eq]=${ownCourseId}&pagination[pageSize]=50`,
    );
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it('instructor GET /api/lessons?filters[course]={own} → sees own lessons', async () => {
    const body = await asJson(
      'instructor',
      `/api/lessons?filters[course][documentId][$eq]=${ownCourseId}&pagination[pageSize]=50`,
    );
    expect(body.data.length).toBeGreaterThan(0);
  });
});
