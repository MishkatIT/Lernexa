"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import { courseSchema, type CourseInput } from "@/lib/schemas";

export type ActionResult =
  | { ok: true; documentId?: string }
  | { ok: false; error: string };

function toPayload(input: CourseInput) {
  const data: Record<string, string> = { title: input.title };
  if (input.description) data.description = input.description;
  if (input.coverImageUrl) data.coverImageUrl = input.coverImageUrl;
  return data;
}

const NO_SESSION = { ok: false as const, error: "Your session expired — log in again." };

export async function createCourse(input: CourseInput): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields." };

  try {
    const res = await strapiFetch<{ data: { documentId: string } }>(
      "/api/courses",
      { method: "POST", token, body: JSON.stringify({ data: toPayload(parsed.data) }) },
    );
    revalidatePath("/manage/courses");
    revalidatePath("/courses");
    return { ok: true, documentId: res.data.documentId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not create the course.",
    };
  }
}

export async function updateCourse(
  documentId: string,
  input: CourseInput,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields." };

  try {
    await strapiFetch(`/api/courses/${documentId}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ data: toPayload(parsed.data) }),
    });
    revalidatePath("/manage/courses");
    revalidatePath(`/manage/courses/${documentId}`);
    revalidatePath("/courses");
    return { ok: true, documentId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not save changes.",
    };
  }
}

export async function deleteCourse(documentId: string): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  try {
    await strapiFetch(`/api/courses/${documentId}`, { method: "DELETE", token });
    revalidatePath("/manage/courses");
    revalidatePath("/courses");
    return { ok: true };
  } catch (err) {
    // 409 from the delete guard carries a human message ("… 23 students are enrolled").
    if (err instanceof StrapiError) return { ok: false, error: err.message };
    return { ok: false, error: "Could not delete the course." };
  }
}
