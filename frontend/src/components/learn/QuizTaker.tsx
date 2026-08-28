"use client";

import { useState } from "react";
import { submitQuiz } from "@/actions/quizzes";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { TakeQuiz, GradeResult } from "@/lib/quiz";

export function QuizTaker({
  courseId,
  quiz,
}: {
  courseId: string;
  quiz: TakeQuiz;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = quiz.questions.length;
  const question = quiz.questions[index];
  const allAnswered = quiz.questions.every((q) => picked[q.id] != null);

  async function onSubmit() {
    if (!allAnswered) {
      setError("Answer every question before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitQuiz(
      quiz.id,
      quiz.questions.map((q) => ({
        questionId: q.id,
        selectedOptionId: picked[q.id] ?? null,
      })),
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.result);
  }

  if (result) {
    const pct = result.totalQuestions
      ? Math.round((result.score / result.totalQuestions) * 100)
      : 0;
    return (
      <div className="mx-auto max-w-[68ch] px-6 py-10 sm:py-14">
        <p className="font-mono text-small text-ink-500">{quiz.title}</p>
        <h1 className="mt-1 text-display text-ink-900">Your result</h1>
        <p className="mt-3 text-h2 text-ink-900">
          {result.score} / {result.totalQuestions}
          <span className="ml-2 text-body font-normal text-ink-500">
            {pct}%
          </span>
        </p>

        <ol className="mt-8 flex flex-col gap-4">
          {quiz.questions.map((q, i) => {
            const graded = result.answers.find((a) => a.questionId === q.id);
            return (
              <li key={q.id} className="rounded-lg border border-ink-200 p-4">
                <p className="text-body font-medium text-ink-900">
                  {i + 1}. {q.prompt}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-small">
                  {q.options.map((o) => {
                    const chosen = graded?.selectedOptionId === o.id;
                    return (
                      <li
                        key={o.id}
                        className={`rounded-sm px-2 py-1 ${
                          chosen && graded?.correct
                            ? "bg-success/10 text-success"
                            : chosen
                              ? "bg-danger/10 text-danger"
                              : "text-ink-700"
                        }`}
                      >
                        {chosen ? "→ " : ""}
                        {o.text}
                      </li>
                    );
                  })}
                </ul>
                {graded && !graded.correct ? (
                  <p className="mt-1 text-small text-ink-500">
                    Marked incorrect.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mt-8">
          <ButtonLink href={`/learn/${courseId}`} variant="secondary">
            Back to the course
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[68ch] px-6 py-10 sm:py-14">
      <div className="mb-4 flex items-center gap-1.5" aria-hidden>
        {quiz.questions.map((q, i) => (
          <span
            key={q.id}
            className={`h-1.5 flex-1 rounded-full ${
              i === index
                ? "bg-accent-500"
                : picked[q.id] != null
                  ? "bg-ink-500"
                  : "bg-ink-100"
            }`}
          />
        ))}
      </div>

      <p className="font-mono text-small text-ink-500">
        Question {index + 1} of {total}
      </p>
      <h1 className="mt-1.5 text-h1 text-ink-900">{question.prompt}</h1>

      <fieldset className="mt-5 flex flex-col gap-2">
        {question.options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-body transition-colors ${
              picked[question.id] === o.id
                ? "border-accent-500 bg-accent-100/40"
                : "border-ink-200 hover:bg-ink-100"
            }`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={picked[question.id] === o.id}
              onChange={() =>
                setPicked((p) => ({ ...p, [question.id]: o.id }))
              }
              className="h-4 w-4 accent-accent-600"
            />
            {o.text}
          </label>
        ))}
      </fieldset>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          ← Back
        </Button>
        {index < total - 1 ? (
          <Button
            variant="secondary"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          >
            Next →
          </Button>
        ) : (
          <Button onClick={onSubmit} disabled={busy}>
            {busy ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}
