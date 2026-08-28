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

export type MyAttempt = {
  score: number;
  totalQuestions: number;
  submittedAt: string;
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

