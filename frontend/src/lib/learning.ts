import "server-only";

import { strapiFetch, StrapiError } from "./strapi";
import { getToken } from "./session";
import type { LessonProgressionMode } from "./schemas";

export type Progress = { completed: number; total: number; percent: number };

export type MyEnrollment = {
  enrolledAt: string;
  course: { id: string; title: string; slug: string | null };
  progress: Progress;
};

/** Per-lesson gate decision, computed server-side (D-038). */
export type LessonGateStatus =
  | "completed"
  | "available"
  | "cannot_complete"
  | "locked";

export type LearnLesson = {
  id: string;
  title: string;
  order: number;
  /** Empty string when `locked` — the server does not send a locked body. */
  content: string;
  videoUrl: string;
  completed: boolean;
  /** "completed" | "available" | "cannot_complete" | "locked" */
  status: LessonGateStatus;
  /** open_locked mode, earlier lessons unfinished — cannot be opened yet */
  locked: boolean;
  /** may this lesson be marked complete right now */
  canComplete: boolean;
  /** short reason shown when the lesson is gated, else null */
  lockHint: string | null;
};

export type LearnContext = {
  course: {
    id: string;
    title: string;
    slug: string | null;
    lessonProgression: LessonProgressionMode;
  };
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
