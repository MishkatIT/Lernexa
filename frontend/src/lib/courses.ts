import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";
import type { LessonProgressionMode } from "./schemas";
import {
  ROSTER_DEFAULT_PAGE_SIZE,
  type StudentProgressPage,
  type StudentProgressRow,
} from "./roster";

// Re-exported so existing `@/lib/courses` importers keep working; the source of
// truth is `./roster` (safe to import from client code).
export {
  ROSTER_PAGE_SIZES,
  ROSTER_DEFAULT_PAGE_SIZE,
} from "./roster";
export type { StudentProgressRow, StudentProgressPage } from "./roster";

/** D-039 — course visibility. `published` shows in the catalogue and takes
 *  enrolments; `enrolled_only` keeps current students learning but is unlisted;
 *  `draft` is owner-only. Older payloads without the field read as "draft". */
export type CourseStatus = "draft" | "enrolled_only" | "published";

export type CourseLite = {
  documentId: string;
  title: string;
  slug: string | null;
  description: string | null;
  coverImageUrl: string | null;
  status: CourseStatus;
  /** D-038 — how students move through lessons. Backend guarantees one of the
   *  three modes; older payloads without the field are treated as "free". */
  lessonProgression: LessonProgressionMode;
  createdAt: string;
  instructor: { fullName: string | null } | null;
  lessons: { title: string; order: number }[];
};

export type ManagedLesson = {
  documentId: string;
  title: string;
  order: number;
  content: string;
  videoUrl: string;
  /** D-039 — an unpublished lesson is hidden from students but still editable here. */
  published: boolean;
};

export type Paged<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
};

type PagedResponse<T> = {
  data: T[];
  meta?: { pagination?: { page: number; pageCount: number; total: number } };
};

const fallbackPagination = { page: 1, pageCount: 1, total: 0 };

/**
 * The anonymous catalogue is byte-identical for every visitor, so it's cached
 * and shared across requests — the same rationale (and shape) as blog.ts
 * `PUBLIC_POSTS`. Course mutations call `updateTag("courses")` (actions/
 * courses.ts) so editors get read-your-own-writes; the short window just bounds
 * drift if that ever misfires. Only ever used for token-less reads.
 */
const PUBLIC_COURSES = {
  cache: "force-cache" as const,
  next: { revalidate: 180, tags: ["courses"] },
};

/** Public catalogue, paginated. Server-forced: non-managers only ever see
 *  `published` courses (D-040 — a published course with no lessons still shows).
 *  `q` searches title + description in Strapi, so it spans every page and
 *  `total` reflects it. */
export async function listCatalogue(
  page = 1,
  q?: string,
  pageSize = 12,
): Promise<Paged<CourseLite>> {
  const qs = new URLSearchParams({
    "pagination[page]": String(Math.max(1, page)),
    "pagination[pageSize]": String(pageSize),
    sort: "createdAt:desc",
  });
  if (q?.trim()) qs.set("q", q.trim());
  const res = await strapiFetch<PagedResponse<CourseLite>>(
    `/api/courses?${qs}`,
    PUBLIC_COURSES,
  );
  const p = res.meta?.pagination ?? fallbackPagination;
  return { items: res.data, page: p.page, pageCount: p.pageCount, total: p.total };
}

/** Manage list, paginated. The backend scopes an instructor to their own
 *  courses from the token (course.find) — no client-side owner filter, which
 *  Strapi strips anyway. `q` is the same server-side search as the catalogue. */
export async function listManagedCourses({
  q,
  page = 1,
  pageSize = 20,
}: {
  q?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<CourseLite>> {
  const token = await getToken();
  const qs = new URLSearchParams({
    "pagination[page]": String(Math.max(1, page)),
    "pagination[pageSize]": String(pageSize),
    sort: "createdAt:desc",
  });
  if (q?.trim()) qs.set("q", q.trim());
  const res = await strapiFetch<PagedResponse<CourseLite>>(
    `/api/courses?${qs}`,
    { token },
  );
  const p = res.meta?.pagination ?? fallbackPagination;
  return { items: res.data, page: p.page, pageCount: p.pageCount, total: p.total };
}

/** Every managed course, across all pages — for aggregation (worklist,
 *  instructor snapshot) where completeness matters more than payload size. */
export async function listAllManagedCourses(q?: string): Promise<CourseLite[]> {
  const out: CourseLite[] = [];
  for (let page = 1; ; page += 1) {
    const res = await listManagedCourses({ q, page, pageSize: 100 });
    out.push(...res.items);
    if (page >= res.pageCount) break;
  }
  return out;
}

/** Send the caller's token when they have one. The backend's findOne gate
 *  (D-039) then resolves visibility per role: a manager / owning instructor
 *  sees any status, a student sees `published` + their own `enrolled_only`,
 *  anonymous sees `published` only. */
export async function getCourseByDocumentId(
  documentId: string,
): Promise<CourseLite | null> {
  const token = await getToken();
  try {
    const res = await strapiFetch<{ data: CourseLite }>(
      `/api/courses/${documentId}`,
      { token },
    );
    return res.data;
  } catch {
    return null;
  }
}

/** Detail lookup by slug. Tries the public endpoint first — that covers every
 *  published course for everyone, including an instructor browsing a peer's
 *  course. On a miss, retries with the caller's token so an enrolled student
 *  reaches their own `enrolled_only` course and an owner reaches their own
 *  draft (D-039). */
export async function getCourseBySlug(slug: string): Promise<CourseLite | null> {
  const qs = `filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`;

  const anon = await strapiFetch<{ data: CourseLite[] }>(
    `/api/courses?${qs}`,
    PUBLIC_COURSES,
  );
  if (anon.data[0]) return anon.data[0];

  const token = await getToken();
  if (!token) return null;
  const authed = await strapiFetch<{ data: CourseLite[] }>(`/api/courses?${qs}`, {
    token,
    cache: "no-store",
  });
  return authed.data[0] ?? null;
}

/** Instructor / CM / admin view — the batched query service, paginated
 *  server-side. Rows come back sorted stuck-first. */
export async function getStudentProgress(
  courseDocumentId: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<StudentProgressPage> {
  const token = await getToken();
  const pageSize = opts.pageSize ?? ROSTER_DEFAULT_PAGE_SIZE;
  const qs = new URLSearchParams({
    page: String(opts.page ?? 1),
    pageSize: String(pageSize),
  });
  try {
    const res = await strapiFetch<{
      data: StudentProgressRow[];
      meta: {
        pagination: {
          page: number;
          pageSize: number;
          pageCount: number;
          total: number;
        };
      };
    }>(`/api/courses/${courseDocumentId}/student-progress?${qs}`, { token });
    return { rows: res.data, ...res.meta.pagination };
  } catch {
    return { rows: [], page: 1, pageSize, pageCount: 1, total: 0 };
  }
}

/** Whole roster, unpaginated — for callers that aggregate across every student
 *  (e.g. the instructor home snapshot's course averages). */
export async function getAllStudentProgress(
  courseDocumentId: string,
): Promise<StudentProgressRow[]> {
  const token = await getToken();
  try {
    const res = await strapiFetch<{ data: StudentProgressRow[] }>(
      `/api/courses/${courseDocumentId}/student-progress?pageSize=all`,
      { token },
    );
    return res.data;
  } catch {
    return [];
  }
}

/** Full lessons for the manager UI. The instructor token + the forced
 *  ownership filter on lesson.find keep this to their own courses. */
export async function getManagedLessons(
  courseDocumentId: string,
): Promise<ManagedLesson[]> {
  const token = await getToken();
  const qs = new URLSearchParams({
    "filters[course][documentId][$eq]": courseDocumentId,
    "sort[0]": "order:asc",
    "fields[0]": "title",
    "fields[1]": "order",
    "fields[2]": "content",
    "fields[3]": "videoUrl",
    "fields[4]": "published",
    "pagination[pageSize]": "200",
  });
  const res = await strapiFetch<{
    data: Array<{
      documentId: string;
      title: string;
      order: number;
      content: string | null;
      videoUrl: string | null;
      published: boolean | null;
    }>;
  }>(`/api/lessons?${qs}`, { token });

  return res.data.map((l) => ({
    documentId: l.documentId,
    title: l.title,
    order: l.order,
    content: l.content ?? "",
    videoUrl: l.videoUrl ?? "",
    published: l.published !== false,
  }));
}
