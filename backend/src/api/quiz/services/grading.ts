/**
 * Quiz grading — PURE functions, plain data in and out. No `ctx`, no Strapi, so
 * grading.test.ts runs without booting anything. This extraction IS the thing
 * the interview evaluates (docs/ARCHITECTURE.md).
 *
 * `isCorrect` lives on the option and must never reach a student's browser
 * (D-004). `toStudentQuiz` builds the student-facing shape by explicit field
 * mapping — it can only contain what it names.
 */

export type Option = { id: number | string; text: string; isCorrect?: boolean };
export type Question = { id: number | string; prompt: string; options: Option[] };
export type Quiz = { id: number | string; title: string; questions: Question[] };

export type StudentOption = { id: number | string; text: string };
export type StudentQuestion = {
  id: number | string;
  prompt: string;
  options: StudentOption[];
};
export type StudentQuiz = {
  id: number | string;
  title: string;
  questions: StudentQuestion[];
};

/** Drops isCorrect. The student submits an option id from this shape. */
export function toStudentQuiz(quiz: Quiz): StudentQuiz {
  return {
    id: quiz.id,
    title: quiz.title,
    questions: (quiz.questions ?? []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: (q.options ?? []).map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

export type SubmittedAnswer = {
  questionId: number | string;
  selectedOptionId: number | string | null;
};

export type GradedAnswer = {
  questionId: number | string;
  selectedOptionId: number | string | null;
  correct: boolean;
};

export type GradeResult = {
  score: number; // number of questions answered correctly
  totalQuestions: number; // snapshot at grade time
  answers: GradedAnswer[];
};

/**
 * Grade a full quiz against a submission.
 *
 * - one question, one selected option (single-answer MCQ)
 * - a question with no submitted answer → correct: false
 * - an unknown / stale option id → correct: false
 * - a question whose options have no `isCorrect: true` → nobody can get it
 *   right; correct: false (the admin attention queue surfaces this quiz)
 * - empty quiz → { score: 0, totalQuestions: 0, answers: [] }
 */
export function gradeQuiz(
  quiz: Quiz,
  submission: SubmittedAnswer[],
): GradeResult {
  const questions = quiz.questions ?? [];
  const byQuestion = new Map(
    submission.map((a) => [String(a.questionId), a.selectedOptionId]),
  );

  const answers: GradedAnswer[] = questions.map((q) => {
    const selected = byQuestion.has(String(q.id))
      ? byQuestion.get(String(q.id))!
      : null;

    const chosen =
      selected == null
        ? undefined
        : (q.options ?? []).find((o) => String(o.id) === String(selected));

    return {
      questionId: q.id,
      selectedOptionId: selected,
      correct: chosen?.isCorrect === true,
    };
  });

  return {
    score: answers.filter((a) => a.correct).length,
    totalQuestions: questions.length,
    answers,
  };
}
