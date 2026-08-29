/**
 * Shared client for the integration test suites (auth / course-lifecycle /
 * blog-lifecycle / learning / admin-platform / isolation).
 *
 * These suites talk to a RUNNING, SEEDED Strapi — the same contract as
 * permission-matrix.test.ts:
 *
 *   npm run seed                                   # once
 *   TEST_API_URL=http://localhost:1337 npm test    # default is localhost
 *
 * Not a *.test.ts file, so vitest's `include` glob never runs it as a suite.
 *
 * Rate limiting: src/middlewares/rate-limit.ts caps mutating /api/ traffic at
 * ~60 req/60s/IP. Run the suite with RATE_LIMIT_ENABLED=false for speed; when
 * it's on, `api()` transparently waits out a 429 and retries, so the suite
 * still passes — just slower.
 */

export const BASE = process.env.TEST_API_URL ?? 'http://localhost:1337';
export const PASSWORD = 'Lernexa123!';

export const ACCOUNTS = {
  admin: 'admin@lernexa.test',
  cm: 'cm@lernexa.test',
  instructor: 'instructor@lernexa.test',
  instructor2: 'instructor2@lernexa.test',
  student: 'student@lernexa.test',
  blocked: 'blocked@lernexa.test',
} as const;

export type ApiResult<T = any> = {
  status: number;
  body: T;
  headers: Headers;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One API call. Returns { status, body } — never throws on a non-2xx, so tests
 * assert on `status` directly. Retries a 429 (up to 6 times, honouring
 * Retry-After, capped at 20s a wait) so an enabled write rate limiter
 * (src/middlewares/rate-limit.ts, ~60 mutating req/60s/IP) does not turn into a
 * spurious failure — it just slows the run. Set RATE_LIMIT_ENABLED=false to
 * avoid the waits entirely.
 */
export async function api<T = any>(
  method: string,
  path: string,
  opts: { token?: string | null; body?: unknown; raw?: boolean } = {},
): Promise<ApiResult<T>> {
  const { token, body } = opts;
  let attempt = 0;

  for (;;) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 429 && attempt < 6) {
      attempt += 1;
      const retryAfter = Number(res.headers.get('retry-after')) || 3;
      await sleep(Math.min(retryAfter, 20) * 1000 + 250);
      continue;
    }

    let parsed: unknown = null;
    if (res.status !== 204) {
      const text = await res.text();
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }
}

/**
 * Process-wide JWT cache. `POST /api/auth/local` is a mutating request and so
 * counts against the write rate limiter; with vitest `isolate: false` this
 * module is shared across every integration file, so each account is logged in
 * at most once for the whole run.
 */
const tokenCache = new Map<string, string>();

/** Log in a seeded account (cached). Returns the JWT, or null (blocked user). */
export async function login(email: string, password = PASSWORD): Promise<string | null> {
  const cached = tokenCache.get(email);
  if (cached) return cached;
  const r = await api('POST', '/api/auth/local', {
    body: { identifier: email, password },
  });
  if (r.status === 200 && (r.body as any).jwt) {
    tokenCache.set(email, (r.body as any).jwt);
    return (r.body as any).jwt;
  }
  return null;
}

export type TestUser = { email: string; id: number; token: string };

/**
 * Idempotent throwaway student. Uses a deterministic `@lernexa.dev` address
 * (swept by `npm run seed:reset`), so repeated suite runs reuse the same rows
 * instead of growing the user table. Registers on first use, logs in after.
 */
export async function ensureStudent(localPart: string): Promise<TestUser> {
  const email = `${localPart}@lernexa.dev`;
  const reg = await api('POST', '/api/auth/local/register', {
    body: { email, password: PASSWORD, fullName: `Audit ${localPart}` },
  });

  let token: string | null;
  if (reg.status === 200 && (reg.body as any).jwt) {
    token = (reg.body as any).jwt;
    tokenCache.set(email, token!);
  } else {
    // Already exists (400 "Email ... already taken") or registration disabled —
    // fall back to logging in (cached).
    token = await login(email);
  }
  if (!token) {
    throw new Error(
      `ensureStudent(${localPart}): could not obtain a token (register status ${reg.status})`,
    );
  }

  const me = await api('GET', '/api/users/me', { token });
  return { email, id: (me.body as any).id, token };
}

/** Poll the seeded accounts into a { role: token } map. */
export async function loginAll(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    out[role] = await login(email);
  }
  return out;
}

export const AUDIT_PREFIX = '__audit__';
export const uniqueTitle = (label: string) =>
  `${AUDIT_PREFIX} ${label} ${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

/**
 * Best-effort teardown for a course created by a test: strip its roster +
 * completions (so the D-020 delete guard doesn't 409), then delete it.
 */
export async function nukeCourse(managerToken: string, courseDocId: string) {
  if (!courseDocId) return;
  // Pull the whole roster (unpaginated) so we can detach every student.
  const prog = await api(
    'GET',
    `/api/courses/${courseDocId}/student-progress?pageSize=all`,
    { token: managerToken },
  );
  const ids: number[] = Array.isArray((prog.body as any)?.data)
    ? (prog.body as any).data.map((r: any) => r.student.id)
    : [];
  if (ids.length) {
    await api('POST', `/api/courses/${courseDocId}/enrollments/remove`, {
      token: managerToken,
      body: { studentIds: ids, purgeProgress: true },
    });
  }
  await api('DELETE', `/api/courses/${courseDocId}`, { token: managerToken });
}

/** Delete every leftover `__audit__` course a previous run may have stranded. */
export async function sweepAuditCourses(managerToken: string) {
  const list = await api(
    'GET',
    `/api/courses?pagination[pageSize]=100&q=${encodeURIComponent(AUDIT_PREFIX)}`,
    { token: managerToken },
  );
  const rows: any[] = (list.body as any)?.data ?? [];
  for (const c of rows) {
    if (typeof c.title === 'string' && c.title.startsWith(AUDIT_PREFIX)) {
      await nukeCourse(managerToken, c.documentId);
    }
  }
}
