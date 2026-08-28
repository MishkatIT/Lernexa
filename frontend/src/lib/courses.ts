import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";

export type CourseLite = {
  documentId: string;
  title: string;
  slug: string | null;
  description: string | null;
  coverImageUrl: string | null;
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

/** Public catalogue list. Server-forced: courses with zero lessons are already
 *  filtered out by the controller for non-managers. */
export async function listCatalogue(): Promise<CourseLite[]> {
  const res = await strapiFetch<{ data: CourseLite[] }>(
    "/api/courses?pagination[pageSize]=48&sort=createdAt:desc",
    { cache: "no-store" },
  );
  return res.data;
}

/** Manage list. Instructors pass their own id; managers see everything. */
export async function listManagedCourses(mineId?: number): Promise<CourseLite[]> {
  const token = await getToken();
  const qs = new URLSearchParams({
    "pagination[pageSize]": "48",
    sort: "createdAt:desc",
  });
  if (mineId) qs.set("filters[instructor][id][$eq]", String(mineId));
  const res = await strapiFetch<{ data: CourseLite[] }>(`/api/courses?${qs}`, {
    token,
  });
  return res.data;
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
