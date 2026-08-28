"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import type { ActionResult } from "./courses";

const NO_SESSION = { ok: false as const, error: "Your session expired — log in again." };

type PostInput = { title: string; body: string; coverImageUrl?: string };

function validate(input: PostInput): string | null {
  if (input.title.trim().length < 3) return "Title needs at least 3 characters.";
  if (input.body.trim().length < 1) return "Write something in the body.";
  return null;
}

export async function createPost(
  input: PostInput,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };
  try {
    const res = await strapiFetch<{ data: { documentId: string } }>(
      "/api/blog-posts",
      {
        method: "POST",
        token,
        body: JSON.stringify({ data: input }),
      },
    );
    revalidatePath("/manage/blog");
    return { ok: true, documentId: res.data.documentId };
  } catch (err) {
    return { ok: false, error: err instanceof StrapiError ? err.message : "Could not create the post." };
  }
}

export async function updatePost(
  documentId: string,
  input: PostInput,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };
  try {
    await strapiFetch(`/api/blog-posts/${documentId}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ data: input }),
    });
    revalidatePath("/manage/blog");
    revalidatePath(`/manage/blog/${documentId}`);
    revalidatePath("/blog");
    return { ok: true, documentId };
  } catch (err) {
    return { ok: false, error: err instanceof StrapiError ? err.message : "Could not save." };
  }
}

async function transition(
  documentId: string,
  verb: "publish" | "unpublish",
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch(`/api/blog-posts/${documentId}/${verb}`, {
      method: "POST",
      token,
    });
    revalidatePath("/manage/blog");
    revalidatePath("/blog");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof StrapiError ? err.message : `Could not ${verb}.` };
  }
}

export async function publishPost(documentId: string): Promise<ActionResult> {
  return transition(documentId, "publish");
}
export async function unpublishPost(documentId: string): Promise<ActionResult> {
  return transition(documentId, "unpublish");
}

export async function deletePost(documentId: string): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch(`/api/blog-posts/${documentId}`, { method: "DELETE", token });
    revalidatePath("/manage/blog");
    revalidatePath("/blog");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof StrapiError ? err.message : "Could not delete." };
  }
}
