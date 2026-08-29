import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  api,
  login,
  ensureStudent,
  loginAll,
  uniqueTitle,
  nukeCourse,
  sweepAuditCourses,
  AUDIT_PREFIX,
  type TestUser,
} from './helpers/api';

/**
 * The course workflow as a real journey (PROJECT_PLAN "Definition of done"):
 *
 *   create → verify → edit → draft/publish visibility → unauthorised modify
 *   → delete guard → delete → verify gone
 *
 * plus the D-039 visibility gate, the D-034 instructor ownership scope, and the
 * D-020 delete guard on both courses and lessons.
 */

let T: Record<string, string | null>;
let student: TestUser;
const created: string[] = []; // course documentIds to clean up

beforeAll(async () => {
  T = await loginAll();
  expect(T.cm, 'seeded content-manager required').toBeTruthy();
  expect(T.instructor && T.instructor2, 'two seeded instructors required').toBeTruthy();
  student = await ensureStudent('audit-course-student');
  await sweepAuditCourses(T.cm!);
}, 180_000);

afterAll(async () => {
  for (const id of created) await nukeCourse(T.cm!, id);
  await sweepAuditCourses(T.cm!);
}, 180_000);

async function makeCourse(token: string, label: string) {
  const title = uniqueTitle(label);
  const r = await api('POST', '/api/courses', {
    token,
    body: { data: { title, description: 'seed description' } },
  });
  expect(r.status).toBe(200);
  const id = r.body.data.documentId as string;
  created.push(id);
  return { id, title, body: r.body.data };
}

async function addPublishedLesson(token: string, courseId: string, order = 1) {
  const r = await api('POST', '/api/lessons', {
    token,
    body: {
      data: {
        title: `${AUDIT_PREFIX} lesson ${order}`,
        order,
        published: true,
        content: 'lesson body',
        course: courseId,
      },
    },
  });
  expect([200, 201]).toContain(r.status);
  return r.body.data.documentId as string;
}

describe('create', () => {
  it('a content-manager creates a course; it starts as draft', async () => {
    const { body } = await makeCourse(T.cm!, 'cm-create');
    expect(body.title).toContain(AUDIT_PREFIX);
    expect(body.status).toBe('draft');
    expect(body.lessonProgression).toBe('free');
  });

  it('a student cannot create a course', async () => {
    const r = await api('POST', '/api/courses', {
      token: student.token,
      body: { data: { title: uniqueTitle('nope') } },
    });
    expect(r.status).toBe(403);
  });

  it('anon cannot create a course', async () => {
    const r = await api('POST', '/api/courses', {
      body: { data: { title: uniqueTitle('nope') } },
    });
    expect(r.status).toBe(403);
  });

  it("an instructor's new course is owned by them (D-034 scope), not visible to another instructor", async () => {
    const { title } = await makeCourse(T.instructor!, 'owner-scope');
    const mine = await api(
      'GET',
      `/api/courses?q=${encodeURIComponent(title)}&pagination[pageSize]=50`,
      { token: T.instructor! },
    );
    expect(mine.body.data.some((c: any) => c.title === title)).toBe(true);

    const others = await api(
      'GET',
      `/api/courses?q=${encodeURIComponent(title)}&pagination[pageSize]=50`,
      { token: T.instructor2! },
    );
    expect(others.body.data.some((c: any) => c.title === title)).toBe(false);
  });
});

describe('draft / publish visibility gate (D-039)', () => {
  let courseId: string;
  let title: string;

  beforeAll(async () => {
    const c = await makeCourse(T.cm!, 'visibility');
    courseId = c.id;
    title = c.title;
    await addPublishedLesson(T.cm!, courseId, 1);
  });

  it('a draft course: findOne is 404 for anon and for a student, 200 for the owner', async () => {
    expect((await api('GET', `/api/courses/${courseId}`, {})).status).toBe(404);
    expect(
      (await api('GET', `/api/courses/${courseId}`, { token: student.token })).status,
    ).toBe(404);
    expect(
      (await api('GET', `/api/courses/${courseId}`, { token: T.cm! })).status,
    ).toBe(200);
  });

  it('a draft course is absent from the anonymous catalogue', async () => {
    const list = await api(
      'GET',
      `/api/courses?q=${encodeURIComponent(title)}&pagination[pageSize]=50`,
      {},
    );
    expect(list.body.data.some((c: any) => c.title === title)).toBe(false);
  });

  it('publish → findOne 200 for anon, and it appears in the anonymous catalogue', async () => {
    const pub = await api('POST', `/api/courses/${courseId}/publish`, { token: T.cm! });
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('published');

    expect((await api('GET', `/api/courses/${courseId}`, {})).status).toBe(200);

    const list = await api(
      'GET',
      `/api/courses?q=${encodeURIComponent(title)}&pagination[pageSize]=50`,
      {},
    );
    expect(list.body.data.some((c: any) => c.title === title)).toBe(true);
  });

  it('unpublish (enrolled_only) → catalogue hides it again, findOne 404 for anon', async () => {
    const un = await api('POST', `/api/courses/${courseId}/unpublish`, {
      token: T.cm!,
      body: { mode: 'enrolled_only' },
    });
    expect(un.status).toBe(200);
    expect(un.body.data.status).toBe('enrolled_only');

    expect((await api('GET', `/api/courses/${courseId}`, {})).status).toBe(404);
    const list = await api(
      'GET',
      `/api/courses?q=${encodeURIComponent(title)}&pagination[pageSize]=50`,
      {},
    );
    expect(list.body.data.some((c: any) => c.title === title)).toBe(false);
  });
});

describe('edit + validation', () => {
  let courseId: string;
  beforeAll(async () => {
    courseId = (await makeCourse(T.cm!, 'edit')).id;
  });

  it('PUT updates a field', async () => {
    const r = await api('PUT', `/api/courses/${courseId}`, {
      token: T.cm!,
      body: { data: { description: 'edited description' } },
    });
    expect(r.status).toBe(200);
    const after = await api('GET', `/api/courses/${courseId}`, { token: T.cm! });
    expect(after.body.data.description).toBe('edited description');
  });

  it('PUT with an invalid lessonProgression → 400', async () => {
    const r = await api('PUT', `/api/courses/${courseId}`, {
      token: T.cm!,
      body: { data: { lessonProgression: 'not-a-mode' } },
    });
    expect(r.status).toBe(400);
  });

  it('PUT with an invalid status → 400', async () => {
    const r = await api('PUT', `/api/courses/${courseId}`, {
      token: T.cm!,
      body: { data: { status: 'live' } },
    });
    expect(r.status).toBe(400);
  });
});

describe('ownership enforcement (IDOR)', () => {
  let courseId: string;
  beforeAll(async () => {
    courseId = (await makeCourse(T.instructor!, 'idor')).id;
  });

  it('another instructor cannot edit it', async () => {
    const r = await api('PUT', `/api/courses/${courseId}`, {
      token: T.instructor2!,
      body: { data: { description: 'hijack' } },
    });
    expect(r.status).toBe(403);
  });

  it('another instructor cannot publish it', async () => {
    const r = await api('POST', `/api/courses/${courseId}/publish`, {
      token: T.instructor2!,
    });
    expect(r.status).toBe(403);
  });

  it('another instructor cannot delete it', async () => {
    const r = await api('DELETE', `/api/courses/${courseId}`, {
      token: T.instructor2!,
    });
    expect(r.status).toBe(403);
  });

  it('a student cannot edit it', async () => {
    const r = await api('PUT', `/api/courses/${courseId}`, {
      token: student.token,
      body: { data: { description: 'hijack' } },
    });
    expect(r.status).toBe(403);
  });

  it('the owner still can', async () => {
    const r = await api('PUT', `/api/courses/${courseId}`, {
      token: T.instructor!,
      body: { data: { description: 'owner edit' } },
    });
    expect(r.status).toBe(200);
  });
});

describe('delete guard — course with enrollments (D-020)', () => {
  let courseId: string;

  beforeAll(async () => {
    const c = await makeCourse(T.cm!, 'delguard');
    courseId = c.id;
    await addPublishedLesson(T.cm!, courseId, 1);
    await api('POST', `/api/courses/${courseId}/publish`, { token: T.cm! });
    const enroll = await api('POST', '/api/enrollments/enroll', {
      token: student.token,
      body: { courseId },
    });
    expect(enroll.status).toBe(200);
  });

  it('DELETE returns 409 with the dependent count while a student is enrolled', async () => {
    const r = await api('DELETE', `/api/courses/${courseId}`, { token: T.cm! });
    expect(r.status).toBe(409);
    expect(r.body.error?.details?.dependents).toBeGreaterThanOrEqual(1);
  });

  it('DELETE succeeds once the roster is cleared', async () => {
    await api('POST', `/api/courses/${courseId}/enrollments/remove`, {
      token: T.cm!,
      body: { studentIds: [student.id], purgeProgress: true },
    });
    const r = await api('DELETE', `/api/courses/${courseId}`, { token: T.cm! });
    expect(r.status).toBe(204);
    created.splice(created.indexOf(courseId), 1);
    // verify gone
    expect((await api('GET', `/api/courses/${courseId}`, { token: T.cm! })).status).toBe(404);
  });
});

describe('delete guard — lesson with completions (D-020)', () => {
  let courseId: string;
  let lessonId: string;

  beforeAll(async () => {
    const c = await makeCourse(T.cm!, 'lesson-delguard');
    courseId = c.id;
    lessonId = await addPublishedLesson(T.cm!, courseId, 1);
    await api('POST', `/api/courses/${courseId}/publish`, { token: T.cm! });
    await api('POST', '/api/enrollments/enroll', {
      token: student.token,
      body: { courseId },
    });
    const done = await api('POST', '/api/lesson-completions/complete', {
      token: student.token,
      body: { lessonId },
    });
    expect(done.status).toBe(200);
  });

  it('DELETE lesson returns 409 while a completion exists', async () => {
    const r = await api('DELETE', `/api/lessons/${lessonId}`, { token: T.cm! });
    expect(r.status).toBe(409);
    expect(r.body.error?.details?.dependents).toBeGreaterThanOrEqual(1);
  });

  it('DELETE lesson succeeds after the completion is removed', async () => {
    await api('DELETE', `/api/lesson-completions/${lessonId}`, {
      token: student.token,
    });
    const r = await api('DELETE', `/api/lessons/${lessonId}`, { token: T.cm! });
    expect(r.status).toBe(204);
  });
});
