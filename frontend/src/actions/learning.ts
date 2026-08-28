"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import type { ActionResult } from "./courses";

type Progress = { completed: number; total: number; percent: number };

const NO_SESSION = { ok: false as const, error: "Your session expired — log in again." };

export async function enrollInCourse(courseDocumentId: string): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch("/api/enrollments/enroll", {
      method: "POST",
      token,
      body: JSON.stringify({ courseId: courseDocumentId }),
    });
    revalidatePath(`/courses/${courseDocumentId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not enrol.",
    };
  }
}

export async function markLessonComplete(
  lessonDocumentId: string,
  courseDocumentId: string,
): Promise<ActionResult & { progress?: Progress }> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    const res = await strapiFetch<{ data: { progress: Progress } }>(
      "/api/lesson-completions/complete",
      { method: "POST", token, body: JSON.stringify({ lessonId: lessonDocumentId }) },
    );
    revalidatePath(`/learn/${courseDocumentId}`);
    revalidatePath("/dashboard");
    return { ok: true, progress: res.data.progress };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not save.",
    };
  }
}

export async function unmarkLessonComplete(
  lessonDocumentId: string,
  courseDocumentId: string,
): Promise<ActionResult & { progress?: Progress }> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    const res = await strapiFetch<{ data: { progress: Progress } }>(
      `/api/lesson-completions/${lessonDocumentId}`,
      { method: "DELETE", token },
    );
    revalidatePath(`/learn/${courseDocumentId}`);
    revalidatePath("/dashboard");
    return { ok: true, progress: res.data.progress };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not save.",
    };
  }
}
