import "server-only";

import { strapiFetch, StrapiError } from "./strapi";
import { getToken } from "./session";

export type BuilderOption = { text: string; isCorrect: boolean };
export type BuilderQuestion = { prompt: string; options: BuilderOption[] };

export type ManagedQuiz = {
  documentId: string;
  title: string;
  questions: BuilderQuestion[];
};

export type TakeOption = { id: number; text: string };
export type TakeQuestion = { id: number; prompt: string; options: TakeOption[] };
/** `id` here is the quiz documentId (for the submit URL); question/option ids are numeric. */
export type TakeQuiz = { id: string; title: string; questions: TakeQuestion[] };

export type GradedAnswer = {
  questionId: number;
  selectedOptionId: number | null;
  correct: boolean;
};
export type GradeResult = {
  score: number;
  totalQuestions: number;
  answers: GradedAnswer[];
};

/** One frozen question row from a past attempt (grading.ts buildAttemptReview).
 *  Attempts taken before the snapshot landed have an empty `answers` array. */
export type AttemptReviewRow = {
  questionId: number | string;
  prompt: string;
  selectedOptionId: number | string | null;
  selectedOptionText: string | null;
  correctOptionId: number | string | null;
  correctOptionText: string | null;
  correct: boolean;
};

export type MyAttempt = {
  id: string;
  score: number;
  totalQuestions: number;
  submittedAt: string;
  answers: AttemptReviewRow[];
  quiz: { id: string; title: string; course: { id: string; title: string } | null } | null;
};

/** Manager view — the full quiz including isCorrect, for the builder. */
export async function getCourseQuiz(
  courseDocumentId: string,
): Promise<ManagedQuiz | null> {
  const token = await getToken();
  const qs = new URLSearchParams({
    "filters[course][documentId][$eq]": courseDocumentId,
    "pagination[pageSize]": "1",
    "populate[questions][populate][options]": "true",
  });
  try {
    const res = await strapiFetch<{
      data: Array<{
        documentId: string;
        title: string;
        questions?: Array<{
          prompt: string;
          options?: Array<{ text: string; isCorrect: boolean }>;
        }>;
      }>;
    }>(`/api/quizzes?${qs}`, { token });
    const q = res.data[0];
    if (!q) return null;
    return {
      documentId: q.documentId,
      title: q.title,
      questions: (q.questions ?? []).map((qq) => ({
        prompt: qq.prompt,
        options: (qq.options ?? []).map((o) => ({
          text: o.text,
          isCorrect: Boolean(o.isCorrect),
        })),
      })),
    };
  } catch {
    return null;
  }
}

/** documentIds of every course that has a quiz — one query, for list badges. */
export async function getCourseIdsWithQuiz(): Promise<Set<string>> {
  const token = await getToken();
  try {
    const res = await strapiFetch<{
      data: Array<{ course?: { documentId: string } | null }>;
    }>(
      "/api/quizzes?fields[0]=title&populate[course][fields][0]=documentId&pagination[pageSize]=200",
      { token },
    );
    return new Set(
      res.data
        .map((q) => q.course?.documentId)
        .filter((id): id is string => Boolean(id)),
    );
  } catch {
    return new Set();
  }
}

/** Student view — sanitised, no isCorrect. Null if not enrolled / no quiz. */
export async function getQuizToTake(
  quizDocumentId: string,
): Promise<TakeQuiz | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await strapiFetch<{ data: TakeQuiz }>(
      `/api/quizzes/${quizDocumentId}/take`,
      { token },
    );
    return res.data;
  } catch (err) {
    if (err instanceof StrapiError) return null;
    throw err;
  }
}

export async function getMyAttempts(): Promise<MyAttempt[]> {
  const token = await getToken();
  if (!token) return [];
  const res = await strapiFetch<{ data: MyAttempt[] }>(
    "/api/quiz-attempts/me",
    { token },
  );
  return res.data;
}

