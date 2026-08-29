import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, login, ensureStudent, ACCOUNTS, PASSWORD } from './helpers/api';

/**
 * Registration, login, session/account-state — the auth surface, end to end
 * against a running Strapi. Covers the happy paths and the negative cases the
 * RBAC matrix and DECISIONS.md D-008 / D-013 / D-030 call out:
 *
 *  - a signup that asks for `role: admin` is created as a student
 *  - duplicate / malformed registrations are rejected
 *  - the seeded blocked account cannot log in
 *  - a token minted before a block is refused (403 ACCOUNT_BLOCKED) after it
 *  - `registrationEnabled = false` makes the endpoint 403 (Tier 2.5, D-026)
 *  - the U&P `GET /api/users` + `PUT /api/users/:id` defaults are locked down
 */

let adminToken: string;

beforeAll(async () => {
  adminToken = (await login(ACCOUNTS.admin))!;
  expect(adminToken, 'admin must be seeded (run: npm run seed)').toBeTruthy();
});

describe('registration — happy path', () => {
  it('creates an account and returns a jwt + user', async () => {
    const email = `audit-reg-${Date.now().toString(36)}@lernexa.dev`;
    const r = await api('POST', '/api/auth/local/register', {
      body: { email, password: PASSWORD, fullName: 'Reg Happy' },
    });
    expect(r.status).toBe(200);
    expect(r.body.jwt).toBeTruthy();
    expect(r.body.user.email).toBe(email);
  });

  it('forces the new account to the student role', async () => {
    const email = `audit-reg-role-${Date.now().toString(36)}@lernexa.dev`;
    const r = await api('POST', '/api/auth/local/register', {
      body: { email, password: PASSWORD, fullName: 'Role Check' },
    });
    expect(r.status).toBe(200);
    const me = await api('GET', '/api/users/me', { token: r.body.jwt });
    expect(me.body.role?.type).toBe('student');
  });

  it('keeps fullName from the body', async () => {
    const email = `audit-reg-name-${Date.now().toString(36)}@lernexa.dev`;
    const r = await api('POST', '/api/auth/local/register', {
      body: { email, password: PASSWORD, fullName: 'Given Name' },
    });
    const me = await api('GET', '/api/users/me', { token: r.body.jwt });
    expect(me.body.fullName).toBe('Given Name');
  });
});

describe('registration — privilege escalation is stripped (D-008 / D-030)', () => {
  it('a body asking for role:admin still yields a student', async () => {
    const email = `audit-esc-${Date.now().toString(36)}@lernexa.dev`;
    const r = await api('POST', '/api/auth/local/register', {
      body: {
        email,
        password: PASSWORD,
        fullName: 'Wants Admin',
        role: 'admin',
        confirmed: true,
        blocked: false,
      },
    });
    expect(r.status).toBe(200);
    const me = await api('GET', '/api/users/me', { token: r.body.jwt });
    expect(me.body.role?.type).toBe('student');
    expect(me.body.role?.type).not.toBe('admin');
  });
});

describe('registration — negative / validation', () => {
  it('rejects a duplicate email', async () => {
    const email = `audit-dup-${Date.now().toString(36)}@lernexa.dev`;
    const first = await api('POST', '/api/auth/local/register', {
      body: { email, password: PASSWORD, fullName: 'First' },
    });
    expect(first.status).toBe(200);
    const second = await api('POST', '/api/auth/local/register', {
      body: { email, password: PASSWORD, fullName: 'Second' },
    });
    expect(second.status).toBe(400);
  });

  it('rejects a malformed email', async () => {
    const r = await api('POST', '/api/auth/local/register', {
      body: { email: 'not-an-email', password: PASSWORD, fullName: 'Bad' },
    });
    expect(r.status).toBe(400);
  });

  it('rejects a password shorter than 6 characters', async () => {
    const r = await api('POST', '/api/auth/local/register', {
      body: {
        email: `audit-short-${Date.now().toString(36)}@lernexa.dev`,
        password: 'ab1',
        fullName: 'Short',
      },
    });
    expect(r.status).toBe(400);
  });

  it('rejects a missing password', async () => {
    const r = await api('POST', '/api/auth/local/register', {
      body: {
        email: `audit-nopw-${Date.now().toString(36)}@lernexa.dev`,
        fullName: 'No PW',
      },
    });
    expect(r.status).toBe(400);
  });
});

describe('login', () => {
  it('accepts valid credentials', async () => {
    const r = await api('POST', '/api/auth/local', {
      body: { identifier: ACCOUNTS.student, password: PASSWORD },
    });
    expect(r.status).toBe(200);
    expect(r.body.jwt).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    const r = await api('POST', '/api/auth/local', {
      body: { identifier: ACCOUNTS.student, password: 'wrong-password' },
    });
    expect(r.status).toBe(400);
  });

  it('rejects an unknown identifier', async () => {
    const r = await api('POST', '/api/auth/local', {
      body: { identifier: 'nobody-here@lernexa.dev', password: PASSWORD },
    });
    expect(r.status).toBe(400);
  });

  it('refuses the seeded blocked account', async () => {
    const r = await api('POST', '/api/auth/local', {
      body: { identifier: ACCOUNTS.blocked, password: PASSWORD },
    });
    expect(r.status).toBe(400);
  });
});

describe('account-state — a token minted before a block is refused after it (D-013)', () => {
  let victim: { email: string; id: number; token: string };

  beforeAll(async () => {
    victim = await ensureStudent('audit-block-victim');
    // make sure it starts unblocked (previous interrupted run)
    await api('PUT', `/api/platform/users/${victim.id}/block`, {
      token: adminToken,
      body: { blocked: false },
    });
    victim.token = (await login(victim.email))!;
  });

  afterAll(async () => {
    await api('PUT', `/api/platform/users/${victim.id}/block`, {
      token: adminToken,
      body: { blocked: false },
    });
  });

  it('the token works before the block', async () => {
    const r = await api('GET', '/api/users/me', { token: victim.token });
    expect(r.status).toBe(200);
  });

  it('the same token is 403 ACCOUNT_BLOCKED after the block, with a reason', async () => {
    const blk = await api('PUT', `/api/platform/users/${victim.id}/block`, {
      token: adminToken,
      body: { blocked: true, reason: 'audit suite: block-replay check' },
    });
    expect(blk.status).toBe(200);

    const replay = await api('GET', '/api/users/me', { token: victim.token });
    expect(replay.status).toBe(403);
    expect(replay.body.error?.message).toBe('ACCOUNT_BLOCKED');
    expect(replay.body.error?.details?.reason).toContain('block-replay');
  });

  it('works again once unblocked', async () => {
    await api('PUT', `/api/platform/users/${victim.id}/block`, {
      token: adminToken,
      body: { blocked: false },
    });
    const again = await api('GET', '/api/users/me', { token: victim.token });
    expect(again.status).toBe(200);
  });
});

describe('registrationEnabled gate (Tier 2.5 / D-026)', () => {
  afterAll(async () => {
    // Always leave registration ON, whatever the assertions did.
    await api('PUT', '/api/site-setting', {
      token: adminToken,
      body: { data: { registrationEnabled: true } },
    });
  });

  it('register returns 403 while registration is disabled, 200 once re-enabled', async () => {
    const off = await api('PUT', '/api/site-setting', {
      token: adminToken,
      body: { data: { registrationEnabled: false } },
    });
    expect(off.status).toBe(200);

    const blocked = await api('POST', '/api/auth/local/register', {
      body: {
        email: `audit-gate-${Date.now().toString(36)}@lernexa.dev`,
        password: PASSWORD,
        fullName: 'Gated',
      },
    });
    expect(blocked.status).toBe(403);

    await api('PUT', '/api/site-setting', {
      token: adminToken,
      body: { data: { registrationEnabled: true } },
    });

    const ok = await api('POST', '/api/auth/local/register', {
      body: {
        email: `audit-gate-ok-${Date.now().toString(36)}@lernexa.dev`,
        password: PASSWORD,
        fullName: 'Ungated',
      },
    });
    expect(ok.status).toBe(200);
  });
});

describe('U&P user endpoints are locked down (RBAC.md)', () => {
  it('GET /api/users is forbidden for a student and for anon', async () => {
    const studentToken = await login(ACCOUNTS.student);
    expect((await api('GET', '/api/users', { token: studentToken })).status).toBe(403);
    expect((await api('GET', '/api/users', {})).status).toBe(403);
  });

  it('GET /api/users/:id is forbidden for a student', async () => {
    const studentToken = await login(ACCOUNTS.student);
    const r = await api('GET', '/api/users/1', { token: studentToken });
    expect(r.status).toBe(403);
  });

  it('PUT /api/users/:id (role escalation) is forbidden for a student', async () => {
    const studentToken = await login(ACCOUNTS.student);
    const me = await api('GET', '/api/users/me', { token: studentToken });
    const r = await api('PUT', `/api/users/${me.body.id}`, {
      token: studentToken,
      body: { role: 1 },
    });
    expect(r.status).toBe(403);
    // and the role really didn't change
    const after = await api('GET', '/api/users/me', { token: studentToken });
    expect(after.body.role?.type).toBe('student');
  });
});
