"use server";

import { revalidatePath } from "next/cache";
import { getToken } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import type { ActionResult } from "./courses";
import type { BuilderQuestion, GradeResult } from "@/lib/quiz";

const NO_SESSION = { ok: false as const, error: "Your session expired — log in again." };

type QuizPayload = { title: string; questions: BuilderQuestion[] };

/** Shape check that mirrors the interview-critical invariants: >= 1 question,
 *  each with >= 2 options and exactly one marked correct. */
function validate(payload: QuizPayload): string | null {
  if (!payload.title.trim()) return "Give the quiz a title.";
  if (payload.questions.length === 0) return "Add at least one question.";
  for (const [i, q] of payload.questions.entries()) {
    if (!q.prompt.trim()) return `Question ${i + 1} needs a prompt.`;
    if (q.options.length < 2) return `Question ${i + 1} needs at least two options.`;
    if (q.options.some((o) => !o.text.trim()))
      return `Question ${i + 1} has an empty option.`;
    if (q.options.filter((o) => o.isCorrect).length !== 1)
      return `Question ${i + 1} needs exactly one correct option.`;
  }
  return null;
}

export async function saveCourseQuiz(
  courseDocumentId: string,
  existingQuizId: string | null,
  payload: QuizPayload,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const problem = validate(payload);
  if (problem) return { ok: false, error: problem };

  const body = JSON.stringify({
    data: {
      title: payload.title.trim(),
      course: courseDocumentId,
      questions: payload.questions.map((q) => ({
        prompt: q.prompt.trim(),
        options: q.options.map((o) => ({
          text: o.text.trim(),
          isCorrect: o.isCorrect,
        })),
      })),
    },
  });

  try {
    if (existingQuizId) {
      await strapiFetch(`/api/quizzes/${existingQuizId}`, {
        method: "PUT",
        token,
        body,
      });
    } else {
      await strapiFetch("/api/quizzes", { method: "POST", token, body });
    }
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not save the quiz.",
    };
  }
}

export async function deleteCourseQuiz(
  courseDocumentId: string,
  quizId: string,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch(`/api/quizzes/${quizId}`, { method: "DELETE", token });
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof StrapiError) return { ok: false, error: err.message };
    return { ok: false, error: "Could not delete the quiz." };
  }
}

/** D-039 — hide/show the course quiz. Recorded attempts are untouched; an
 *  unpublished quiz just stops appearing in the student's /learn view. */
export async function setQuizPublished(
  courseDocumentId: string,
  quizId: string,
  published: boolean,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch(
      `/api/quizzes/${quizId}/${published ? "publish" : "unpublish"}`,
      { method: "POST", token },
    );
    revalidatePath(`/manage/courses/${courseDocumentId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof StrapiError
          ? err.message
          : `Could not ${published ? "publish" : "hide"} the quiz.`,
    };
  }
}

export async function submitQuiz(
  quizDocumentId: string,
  answers: { questionId: number; selectedOptionId: number | null }[],
): Promise<{ ok: true; result: GradeResult } | { ok: false; error: string }> {
  const token = await getToken();
  if (!token) return { ok: false, error: "Your session expired — log in again." };
  try {
    const res = await strapiFetch<{ data: GradeResult }>(
      `/api/quizzes/${quizDocumentId}/submit`,
      { method: "POST", token, body: JSON.stringify({ answers }) },
    );
    revalidatePath("/dashboard");
    return { ok: true, result: res.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not submit.",
    };
  }
}
