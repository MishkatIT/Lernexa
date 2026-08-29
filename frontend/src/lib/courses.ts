import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";
import type { LessonProgressionMode } from "./schemas";

export type CourseLite = {
  documentId: string;
  title: string;
  slug: string | null;
  description: string | null;
  coverImageUrl: string | null;
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

/** Public catalogue, paginated. Server-forced: courses with zero lessons are
 *  filtered out by the controller for non-managers. `q` searches title +
 *  description in Strapi, so it spans every page and `total` reflects it. */
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
    { cache: "no-store" },
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

export async function getCourseByDocumentId(
  documentId: string,
): Promise<CourseLite | null> {
  try {
    const res = await strapiFetch<{ data: CourseLite }>(
      `/api/courses/${documentId}`,
    );
    return res.data;
  } catch {
    return null;
  }
}

export async function getCourseBySlug(slug: string): Promise<CourseLite | null> {
  const res = await strapiFetch<{ data: CourseLite[] }>(
    `/api/courses?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`,
    { cache: "no-store" },
  );
  return res.data[0] ?? null;
}

export type StudentProgressRow = {
  student: { id: number; name: string };
  enrolledAt: string;
  lastActivity: string | null;
  progress: { completed: number; total: number; percent: number };
};

/** Instructor / CM / admin view — the batched 2-query service. Sorted stuck-first
 *  server-side. */
export async function getStudentProgress(
  courseDocumentId: string,
): Promise<StudentProgressRow[]> {
  const token = await getToken();
  try {
    const res = await strapiFetch<{ data: StudentProgressRow[] }>(
      `/api/courses/${courseDocumentId}/student-progress`,
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
    "pagination[pageSize]": "200",
  });
  const res = await strapiFetch<{
    data: Array<{
      documentId: string;
      title: string;
      order: number;
      content: string | null;
      videoUrl: string | null;
    }>;
  }>(`/api/lessons?${qs}`, { token });

  return res.data.map((l) => ({
    documentId: l.documentId,
    title: l.title,
    order: l.order,
    content: l.content ?? "",
    videoUrl: l.videoUrl ?? "",
  }));
}
