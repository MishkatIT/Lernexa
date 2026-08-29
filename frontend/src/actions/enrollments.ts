"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import type { ActionResult } from "./courses";

const NO_SESSION = {
  ok: false as const,
  error: "Your session expired — log in again.",
};

/** One line of the add-students result — the backend reports an outcome per
 *  email so a partial batch still tells the manager exactly what happened. */
export type AddEnrollmentOutcome =
  | "enrolled"
  | "already-enrolled"
  | "not-found"
  | "not-a-student"
  | "blocked";

export type AddEnrollmentRow = {
  email: string;
  status: AddEnrollmentOutcome;
  name?: string;
};

type AddResult = ActionResult & {
  added?: number;
  requested?: number;
  results?: AddEnrollmentRow[];
};

/** Manager adds students to a course by email. `resetProgress` clears each
 *  resolved student's completions for this course (start from 0%); off by
 *  default so a re-add resumes prior progress. */
export async function addEnrollments(
  courseDocumentId: string,
  emails: string[],
  resetProgress = false,
): Promise<AddResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const cleaned = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (cleaned.length === 0) {
    return { ok: false, error: "Enter at least one email address." };
  }

  try {
    const res = await strapiFetch<{
      data: { added: number; requested: number; results: AddEnrollmentRow[] };
    }>(`/api/courses/${courseDocumentId}/enrollments`, {
      method: "POST",
      token,
      body: JSON.stringify({ emails: cleaned, resetProgress }),
    });
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    return {
      ok: true,
      added: res.data.added,
      requested: res.data.requested,
      results: res.data.results,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof StrapiError ? err.message : "Could not add students.",
    };
  }
}

/** Manager removes students from a course. `purgeProgress` also deletes their
 *  completion records for this course; without it only the enrollment row goes
 *  and a plain re-add restores everything. */
export async function removeEnrollments(
  courseDocumentId: string,
  studentIds: number[],
  purgeProgress = false,
): Promise<ActionResult & { removed?: number; purged?: number }> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const ids = [...new Set(studentIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) {
    return { ok: false, error: "Select at least one student." };
  }

  try {
    const res = await strapiFetch<{ data: { removed: number; purged: number } }>(
      `/api/courses/${courseDocumentId}/enrollments/remove`,
      {
        method: "POST",
        token,
        body: JSON.stringify({ studentIds: ids, purgeProgress }),
      },
    );
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    return { ok: true, removed: res.data.removed, purged: res.data.purged };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof StrapiError ? err.message : "Could not remove students.",
    };
  }
}
