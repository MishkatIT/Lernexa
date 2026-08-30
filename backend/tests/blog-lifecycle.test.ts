import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginAll, ensureStudent, AUDIT_PREFIX, type TestUser } from './helpers/api';

/**
 * The blog workflow (PROJECT_PLAN Tier 2, DECISIONS.md D-006):
 *
 *   create (draft) → not public → manager sees draft → publish → public
 *   → unpublish → not public → delete → gone
 *
 * plus: only admin / content-manager may write; instructors and students
 * cannot; a non-manager can never see a draft even by asking for it; an
 * unknown category is dropped rather than stored.
 */

let T: Record<string, string | null>;
let student: TestUser;
const created: string[] = [];

const title = (label: string) =>
  `${AUDIT_PREFIX} blog ${label} ${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

beforeAll(async () => {
  T = await loginAll();
  expect(T.cm).toBeTruthy();
  student = await ensureStudent('audit-blog-student');
}, 180_000);

afterAll(async () => {
  for (const id of created) {
    await api('DELETE', `/api/blog-posts/${id}`, { token: T.admin! });
  }
}, 180_000);

async function makeDraft(token: string, label: string, extra: Record<string, unknown> = {}) {
  const t = title(label);
  const r = await api('POST', '/api/blog-posts', {
    token,
    body: { data: { title: t, body: 'A short body for the audit post.', ...extra } },
  });
  expect(r.status).toBe(200);
  const id = r.body.data.documentId as string;
  created.push(id);
  return { id, title: t, data: r.body.data };
}

describe('create — draft, manager only', () => {
  it('a content-manager creates a post; it is a draft (no publishedAt)', async () => {
    const { data } = await makeDraft(T.cm!, 'cm');
    expect(data.publishedAt ?? null).toBeNull();
  });

  it('an instructor cannot create a post', async () => {
    const r = await api('POST', '/api/blog-posts', {
      token: T.instructor!,
      body: { data: { title: title('instr'), body: 'x' } },
    });
    expect(r.status).toBe(403);
  });

  it('a student cannot create a post', async () => {
    const r = await api('POST', '/api/blog-posts', {
      token: student.token,
      body: { data: { title: title('stu'), body: 'x' } },
    });
    expect(r.status).toBe(403);
  });

  it('anon cannot create a post', async () => {
    const r = await api('POST', '/api/blog-posts', {
      body: { data: { title: title('anon'), body: 'x' } },
    });
    expect(r.status).toBe(403);
  });

  it('an unknown category is dropped, not stored', async () => {
    const { data } = await makeDraft(T.cm!, 'cat', { category: 'not-a-category' });
    expect(data.category ?? null).toBeNull();
  });

  it('a known category is kept', async () => {
    const { data } = await makeDraft(T.cm!, 'cat2', { category: 'backend' });
    expect(data.category).toBe('backend');
  });
});

describe('draft visibility', () => {
  let id: string;
  let t: string;
  beforeAll(async () => {
    const d = await makeDraft(T.cm!, 'vis');
    id = d.id;
    t = d.title;
  });

  it('the anonymous feed does not list a draft', async () => {
    const list = await api(
      'GET',
      `/api/blog-posts?q=${encodeURIComponent(AUDIT_PREFIX)}&pagination[pageSize]=100`,
      {},
    );
    expect(list.body.data.every((p: any) => p.publishedAt)).toBe(true);
    expect(list.body.data.some((p: any) => p.title === t)).toBe(false);
  });

  it('anon findOne on a draft is 404', async () => {
    expect((await api('GET', `/api/blog-posts/${id}`, {})).status).toBe(404);
  });

  it('a manager can list the draft set with ?status=draft', async () => {
    const list = await api(
      'GET',
      `/api/blog-posts?status=draft&q=${encodeURIComponent(AUDIT_PREFIX)}&pagination[pageSize]=100`,
      { token: T.cm! },
    );
    expect(list.body.data.some((p: any) => p.title === t)).toBe(true);
  });

  it('a non-manager cannot reach the draft set even by asking (?status=draft ignored)', async () => {
    const list = await api(
      'GET',
      `/api/blog-posts?status=draft&q=${encodeURIComponent(AUDIT_PREFIX)}&pagination[pageSize]=100`,
      { token: T.instructor! },
    );
    expect(list.body.data.every((p: any) => p.publishedAt)).toBe(true);
    expect(list.body.data.some((p: any) => p.title === t)).toBe(false);
  });
});

describe('publish → public → unpublish', () => {
  let id: string;
  let t: string;
  beforeAll(async () => {
    const d = await makeDraft(T.cm!, 'pub');
    id = d.id;
    t = d.title;
  });

  it('publish makes it visible to anon (list + findOne)', async () => {
    const pub = await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    expect(pub.status).toBe(200);

    expect((await api('GET', `/api/blog-posts/${id}`, {})).status).toBe(200);
    const list = await api(
      'GET',
      `/api/blog-posts?q=${encodeURIComponent(AUDIT_PREFIX)}&pagination[pageSize]=100`,
      {},
    );
    expect(list.body.data.some((p: any) => p.title === t)).toBe(true);
  });

  it('unpublish removes it from the anon feed again', async () => {
    const un = await api('POST', `/api/blog-posts/${id}/unpublish`, { token: T.cm! });
    expect(un.status).toBe(200);

    expect((await api('GET', `/api/blog-posts/${id}`, {})).status).toBe(404);
    const list = await api(
      'GET',
      `/api/blog-posts?q=${encodeURIComponent(AUDIT_PREFIX)}&pagination[pageSize]=100`,
      {},
    );
    expect(list.body.data.some((p: any) => p.title === t)).toBe(false);
  });

  it('an instructor cannot publish', async () => {
    const r = await api('POST', `/api/blog-posts/${id}/publish`, { token: T.instructor! });
    expect(r.status).toBe(403);
  });
});

describe('draft-vs-live state (manager findOne `live`)', () => {
  it('a fresh draft reports never_published', async () => {
    const { id } = await makeDraft(T.cm!, 'live-new');
    const r = await api('GET', `/api/blog-posts/${id}`, { token: T.cm! });
    expect(r.status).toBe(200);
    expect(r.body.data.live.state).toBe('never_published');
    expect(r.body.data.live.changedFields).toEqual([]);
  });

  it('after publish the draft matches live → state "live"', async () => {
    const { id } = await makeDraft(T.cm!, 'live-pub');
    await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    const r = await api('GET', `/api/blog-posts/${id}`, { token: T.cm! });
    expect(r.body.data.live.state).toBe('live');
    expect(r.body.data.live.publishedAt).toBeTruthy();
    expect(r.body.data.live.lastPublishedAt).toBeTruthy();
  });

  it('editing a published post (draft-only) → state "modified" naming the changed fields', async () => {
    const { id } = await makeDraft(T.cm!, 'live-mod');
    await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    // `?status=draft` — the write path the manage UI uses: edits land on the
    // draft, the published version is untouched until an explicit publish.
    await api('PUT', `/api/blog-posts/${id}?status=draft`, {
      token: T.cm!,
      body: { data: { body: 'a materially different body' } },
    });
    const r = await api('GET', `/api/blog-posts/${id}`, { token: T.cm! });
    expect(r.body.data.live.state).toBe('modified');
    expect(r.body.data.live.changedFields).toContain('body');
    // the public (published) copy is still the original
    const pub = await api('GET', `/api/blog-posts/${id}`, {});
    expect(pub.body.data.body).not.toContain('materially different');
  });

  it('re-publishing clears the modified state', async () => {
    const { id } = await makeDraft(T.cm!, 'live-republish');
    await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    await api('PUT', `/api/blog-posts/${id}?status=draft`, {
      token: T.cm!,
      body: { data: { subtitle: 'new subtitle' } },
    });
    await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    const r = await api('GET', `/api/blog-posts/${id}`, { token: T.cm! });
    expect(r.body.data.live.state).toBe('live');
    expect(r.body.data.live.changedFields).toEqual([]);
  });

  it('unpublishing a once-live post → state "unpublished" (keeps lastPublishedAt)', async () => {
    const { id } = await makeDraft(T.cm!, 'live-unpub');
    await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    await api('POST', `/api/blog-posts/${id}/unpublish`, { token: T.cm! });
    const r = await api('GET', `/api/blog-posts/${id}`, { token: T.cm! });
    expect(r.status).toBe(200);
    expect(r.body.data.live.state).toBe('unpublished');
    expect(r.body.data.live.lastPublishedAt).toBeTruthy();
    expect(r.body.data.live.publishedAt).toBeNull();
  });

  it('a non-manager read never carries `live`', async () => {
    const { id } = await makeDraft(T.cm!, 'live-anon');
    await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    const r = await api('GET', `/api/blog-posts/${id}`, {});
    expect(r.status).toBe(200);
    expect(r.body.data.live ?? null).toBeNull();
  });

  it('the manager list carries `live` and flags a modified post', async () => {
    const { id, title: t } = await makeDraft(T.cm!, 'live-list');
    await api('POST', `/api/blog-posts/${id}/publish`, { token: T.cm! });
    await api('PUT', `/api/blog-posts/${id}?status=draft`, {
      token: T.cm!,
      body: { data: { body: 'list-diff body change' } },
    });
    const list = await api(
      'GET',
      `/api/blog-posts?q=${encodeURIComponent(AUDIT_PREFIX)}&pagination[pageSize]=100`,
      { token: T.cm! },
    );
    const row = list.body.data.find((p: any) => p.title === t);
    expect(row?.live?.state).toBe('modified');
    // the anonymous feed row has no `live`
    const anon = await api(
      'GET',
      `/api/blog-posts?q=${encodeURIComponent(AUDIT_PREFIX)}&pagination[pageSize]=100`,
      {},
    );
    expect((anon.body.data.find((p: any) => p.title === t)?.live) ?? null).toBeNull();
  });
});

describe('edit + delete', () => {
  it('a content-manager edits a post', async () => {
    const { id } = await makeDraft(T.cm!, 'edit');
    const r = await api('PUT', `/api/blog-posts/${id}`, {
      token: T.cm!,
      body: { data: { subtitle: 'edited subtitle' } },
    });
    expect(r.status).toBe(200);
  });

  it('an instructor cannot edit a post', async () => {
    const { id } = await makeDraft(T.cm!, 'edit2');
    const r = await api('PUT', `/api/blog-posts/${id}`, {
      token: T.instructor!,
      body: { data: { subtitle: 'nope' } },
    });
    expect(r.status).toBe(403);
  });

  it('delete removes the post', async () => {
    const { id } = await makeDraft(T.cm!, 'del');
    const r = await api('DELETE', `/api/blog-posts/${id}`, { token: T.cm! });
    expect([200, 204]).toContain(r.status);
    created.splice(created.indexOf(id), 1);
    expect((await api('GET', `/api/blog-posts/${id}`, { token: T.cm! })).status).toBe(404);
  });

  it('a student cannot delete a post', async () => {
    const { id } = await makeDraft(T.cm!, 'del2');
    const r = await api('DELETE', `/api/blog-posts/${id}`, { token: student.token });
    expect(r.status).toBe(403);
  });
});
