import "server-only";

import { strapiFetch, StrapiError } from "./strapi";
import { getToken } from "./session";

export type Progress = { completed: number; total: number; percent: number };

export type MyEnrollment = {
  enrolledAt: string;
  course: { id: string; title: string; slug: string | null };
  progress: Progress;
};

export type LearnLesson = {
  id: string;
  title: string;
  order: number;
  content: string;
  videoUrl: string;
  completed: boolean;
};

export type LearnContext = {
  course: { id: string; title: string; slug: string | null };
  lessons: LearnLesson[];
  progress: Progress;
  nextLessonId: string | null;
  quizId: string | null;
};

export async function getMyEnrollments(): Promise<MyEnrollment[]> {
  const token = await getToken();
  if (!token) return [];
  const res = await strapiFetch<{ data: MyEnrollment[] }>(
    "/api/enrollments/me",
    { token },
  );
  return res.data;
}

/** Returns null on 403 (not enrolled) or 404. */
export async function getLearnContext(
  courseDocumentId: string,
): Promise<LearnContext | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await strapiFetch<{ data: LearnContext }>(
      `/api/courses/${courseDocumentId}/learn`,
      { token },
    );
    return res.data;
  } catch (err) {
    if (err instanceof StrapiError && (err.status === 403 || err.status === 404)) {
      return null;
    }
    throw err;
  }
}

export async function isEnrolled(courseDocumentId: string): Promise<boolean> {
  const enrollments = await getMyEnrollments();
  return enrollments.some((e) => e.course.id === courseDocumentId);
}
