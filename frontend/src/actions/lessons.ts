"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import { lessonSchema, type LessonInput } from "@/lib/schemas";
import type { ActionResult } from "./courses";

const NO_SESSION = { ok: false as const, error: "Your session expired — log in again." };

function toPayload(input: LessonInput) {
  const data: Record<string, string | number> = {
    title: input.title,
    order: input.order,
  };
  if (input.content) data.content = input.content;
  if (input.videoUrl) data.videoUrl = input.videoUrl;
  return data;
}

export async function createLesson(
  courseDocumentId: string,
  input: LessonInput,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields." };

  try {
    await strapiFetch("/api/lessons", {
      method: "POST",
      token,
      body: JSON.stringify({
        data: { ...toPayload(parsed.data), course: courseDocumentId },
      }),
    });
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    revalidatePath("/courses");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not add the lesson.",
    };
  }
}

export async function updateLesson(
  documentId: string,
  courseDocumentId: string,
  input: LessonInput,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields." };

  try {
    await strapiFetch(`/api/lessons/${documentId}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ data: toPayload(parsed.data) }),
    });
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    revalidatePath("/courses");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not save the lesson.",
    };
  }
}

/** D-039 — hide/show a single lesson. An unpublished lesson leaves every
 *  student view and stops counting toward progress. */
export async function setLessonPublished(
  documentId: string,
  courseDocumentId: string,
  published: boolean,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  try {
    await strapiFetch(
      `/api/lessons/${documentId}/${published ? "publish" : "unpublish"}`,
      { method: "POST", token },
    );
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    revalidatePath("/courses");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof StrapiError
          ? err.message
          : `Could not ${published ? "publish" : "hide"} the lesson.`,
    };
  }
}

export async function deleteLesson(
  documentId: string,
  courseDocumentId: string,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  try {
    await strapiFetch(`/api/lessons/${documentId}`, { method: "DELETE", token });
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    revalidatePath("/courses");
    return { ok: true };
  } catch (err) {
    // 409 from the delete guard carries a human message.
    if (err instanceof StrapiError) return { ok: false, error: err.message };
    return { ok: false, error: "Could not delete the lesson." };
  }
}
