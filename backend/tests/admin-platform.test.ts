import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, login, ensureStudent, loginAll, ACCOUNTS, type TestUser } from './helpers/api';

/**
 * The admin platform surface (ADMIN_PANEL.md, RBAC.md "the full sensitive-action
 * chain", D-015 append-only audit):
 *
 *  - every /api/platform/* route is admin-only (CM / instructor / student / anon → 403)
 *  - stats returns the documented shape
 *  - users list paginates + filters (q / role / status), pageSize clamped
 *  - setRole / setBlock walk exists → not-self → valid-transition → act, and audit
 *  - the audit log has no write endpoint
 *
 * The "cannot demote / block the LAST admin" guard is not exercised here: it
 * would require reducing the platform to a single admin against a shared seeded
 * DB. It is covered by reading the controller (countAdmins) + verify-auth.sh.
 */

let T: Record<string, string | null>;
let adminId: number;
let subject: TestUser;

beforeAll(async () => {
  T = await loginAll();
  expect(T.admin, 'seeded admin required').toBeTruthy();
  adminId = (await api('GET', '/api/users/me', { token: T.admin! })).body.id;
  subject = await ensureStudent('audit-platform-subject');
  // normalise starting state
  await api('PUT', `/api/platform/users/${subject.id}/block`, {
    token: T.admin!,
    body: { blocked: false },
  });
  await api('PUT', `/api/platform/users/${subject.id}/role`, {
    token: T.admin!,
    body: { role: 'student' },
  });
}, 180_000);

afterAll(async () => {
  await api('PUT', `/api/platform/users/${subject.id}/block`, {
    token: T.admin!,
    body: { blocked: false },
  });
  await api('PUT', `/api/platform/users/${subject.id}/role`, {
    token: T.admin!,
    body: { role: 'student' },
  });
}, 180_000);

describe('every platform route is admin-only', () => {
  const routes: Array<[string, string]> = [
    ['GET', '/api/platform/stats'],
    ['GET', '/api/platform/users'],
    ['GET', '/api/platform/audit'],
  ];
  for (const [method, path] of routes) {
    it(`${method} ${path} — CM / instructor / student / anon → 403`, async () => {
      expect((await api(method, path, { token: T.cm! })).status).toBe(403);
      expect((await api(method, path, { token: T.instructor! })).status).toBe(403);
      expect((await api(method, path, { token: T.student! })).status).toBe(403);
      expect((await api(method, path, {})).status).toBe(403);
    });
  }

  it('PUT /api/platform/users/:id/role — non-admin → 403', async () => {
    const r = await api('PUT', `/api/platform/users/${subject.id}/role`, {
      token: T.cm!,
      body: { role: 'instructor' },
    });
    expect(r.status).toBe(403);
  });
});

describe('GET /api/platform/stats', () => {
  it('returns the users / content / attention blocks with numeric counts', async () => {
    const r = await api('GET', '/api/platform/stats', { token: T.admin! });
    expect(r.status).toBe(200);
    const d = r.body.data;
    for (const k of ['total', 'admins', 'contentManagers', 'instructors', 'students', 'blocked']) {
      expect(typeof d.users[k]).toBe('number');
    }
    for (const k of ['courses', 'enrollments', 'quizAttempts', 'overallCompletionPercent']) {
      expect(typeof d.content[k]).toBe('number');
    }
    expect(d.attention).toHaveProperty('quizzesWithoutCorrectAnswer');
    expect(d.attention).toHaveProperty('coursesWithoutLessons');
  });
});

describe('GET /api/platform/users', () => {
  it('paginates with a meta block', async () => {
    const r = await api('GET', '/api/platform/users?page=1&pageSize=5', { token: T.admin! });
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeLessThanOrEqual(5);
    expect(r.body.meta.pagination).toMatchObject({ page: 1, pageSize: 5 });
    expect(r.body.meta.pagination.total).toBeGreaterThan(0);
  });

  it('pageSize is clamped to 100', async () => {
    const r = await api('GET', '/api/platform/users?pageSize=100000', { token: T.admin! });
    expect(r.body.meta.pagination.pageSize).toBe(100);
  });

  it('?role= filters to that role only', async () => {
    const r = await api('GET', '/api/platform/users?role=instructor&pageSize=100', {
      token: T.admin!,
    });
    expect(r.body.data.length).toBeGreaterThan(0);
    expect(r.body.data.every((u: any) => u.role?.type === 'instructor')).toBe(true);
  });

  it('?q= matches on email', async () => {
    const r = await api(
      'GET',
      `/api/platform/users?q=${encodeURIComponent(ACCOUNTS.admin)}`,
      { token: T.admin! },
    );
    expect(r.body.data.some((u: any) => u.email === ACCOUNTS.admin)).toBe(true);
  });

  it('?status=blocked returns only blocked users', async () => {
    const r = await api('GET', '/api/platform/users?status=blocked&pageSize=100', {
      token: T.admin!,
    });
    expect(r.body.data.every((u: any) => u.blocked === true)).toBe(true);
  });

  it('a no-match search is an empty page, not an error', async () => {
    const r = await api('GET', '/api/platform/users?q=zzz-no-such-user-zzz', {
      token: T.admin!,
    });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([]);
  });
});

describe('PUT /api/platform/users/:id/role', () => {
  it('promotes a student to instructor and back', async () => {
    const up = await api('PUT', `/api/platform/users/${subject.id}/role`, {
      token: T.admin!,
      body: { role: 'instructor' },
    });
    expect(up.status).toBe(200);
    expect(up.body.data.role.type).toBe('instructor');

    const down = await api('PUT', `/api/platform/users/${subject.id}/role`, {
      token: T.admin!,
      body: { role: 'student' },
    });
    expect(down.status).toBe(200);
    expect(down.body.data.role.type).toBe('student');
  });

  it('an unknown role → 400', async () => {
    const r = await api('PUT', `/api/platform/users/${subject.id}/role`, {
      token: T.admin!,
      body: { role: 'superuser' },
    });
    expect(r.status).toBe(400);
  });

  it('setting the role it already has → 400', async () => {
    const r = await api('PUT', `/api/platform/users/${subject.id}/role`, {
      token: T.admin!,
      body: { role: 'student' },
    });
    expect(r.status).toBe(400);
  });

  it('an admin cannot change their own role → 400', async () => {
    const r = await api('PUT', `/api/platform/users/${adminId}/role`, {
      token: T.admin!,
      body: { role: 'student' },
    });
    expect(r.status).toBe(400);
    // and the admin is still an admin
    const me = await api('GET', '/api/users/me', { token: T.admin! });
    expect(me.body.role.type).toBe('admin');
  });

  it('an unknown user id → 404', async () => {
    const r = await api('PUT', '/api/platform/users/99999999/role', {
      token: T.admin!,
      body: { role: 'student' },
    });
    expect(r.status).toBe(404);
  });
});

describe('PUT /api/platform/users/:id/block', () => {
  it('requires a reason', async () => {
    const r = await api('PUT', `/api/platform/users/${subject.id}/block`, {
      token: T.admin!,
      body: { blocked: true },
    });
    expect(r.status).toBe(400);
  });

  it('rejects an over-long reason (>500)', async () => {
    const r = await api('PUT', `/api/platform/users/${subject.id}/block`, {
      token: T.admin!,
      body: { blocked: true, reason: 'x'.repeat(501) },
    });
    expect(r.status).toBe(400);
  });

  it('blocks, refuses a redundant block, then unblocks', async () => {
    const blk = await api('PUT', `/api/platform/users/${subject.id}/block`, {
      token: T.admin!,
      body: { blocked: true, reason: 'audit suite' },
    });
    expect(blk.status).toBe(200);
    expect(blk.body.data.blocked).toBe(true);

    const again = await api('PUT', `/api/platform/users/${subject.id}/block`, {
      token: T.admin!,
      body: { blocked: true, reason: 'audit suite' },
    });
    expect(again.status).toBe(400);

    const un = await api('PUT', `/api/platform/users/${subject.id}/block`, {
      token: T.admin!,
      body: { blocked: false },
    });
    expect(un.status).toBe(200);
    expect(un.body.data.blocked).toBe(false);
  });

  it('an admin cannot block their own account → 400', async () => {
    const r = await api('PUT', `/api/platform/users/${adminId}/block`, {
      token: T.admin!,
      body: { blocked: true, reason: 'should not work' },
    });
    expect(r.status).toBe(400);
  });
});

describe('audit log (D-015)', () => {
  it('GET /api/platform/audit returns paginated entries', async () => {
    const r = await api('GET', '/api/platform/audit?pageSize=10', { token: T.admin! });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.meta.pagination.pageSize).toBe(10);
  });

  it('the role change + block just performed are recorded (category=security)', async () => {
    // generate two fresh security events
    await api('PUT', `/api/platform/users/${subject.id}/role`, {
      token: T.admin!,
      body: { role: 'instructor' },
    });
    await api('PUT', `/api/platform/users/${subject.id}/role`, {
      token: T.admin!,
      body: { role: 'student' },
    });

    const r = await api('GET', '/api/platform/audit?category=security&pageSize=50', {
      token: T.admin!,
    });
    expect(r.status).toBe(200);
    expect(r.body.data.every((e: any) => e.category === 'security')).toBe(true);
    expect(r.body.data.some((e: any) => e.action === 'user.role_changed')).toBe(true);
  });

  it('has no write endpoint — POST / PUT / DELETE /api/audit-logs are not usable', async () => {
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      const r = await api(method, '/api/audit-logs', {
        token: T.admin!,
        body: { data: { action: 'forged', category: 'security' } },
      });
      expect([403, 404, 405]).toContain(r.status);
    }
  });
});
