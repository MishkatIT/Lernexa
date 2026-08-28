"use client";

import { useState } from "react";
import Link from "next/link";
import { submitQuiz } from "@/actions/quizzes";
import { Button } from "@/components/ui/Button";
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
    return (
      <div className="mx-auto max-w-[68ch] px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {quiz.title} — result
        </h1>
        <p className="mt-2 text-[17px] text-ink-900">
          You scored{" "}
          <span className="font-semibold">
            {result.score} / {result.totalQuestions}
          </span>
          .
        </p>

        <ol className="mt-6 flex flex-col gap-4">
          {quiz.questions.map((q, i) => {
            const graded = result.answers.find((a) => a.questionId === q.id);
            return (
              <li key={q.id} className="rounded-sm border border-ink-200 p-4">
                <p className="text-[15px] font-medium text-ink-900">
                  {i + 1}. {q.prompt}
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-[14px]">
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
                  <p className="mt-1 text-[13px] text-ink-500">
                    Marked incorrect.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mt-8">
          <Link
            href={`/learn/${courseId}`}
            className="rounded-sm border border-ink-200 px-4 py-2 text-[15px] font-medium text-ink-900 hover:bg-ink-100"
          >
            Back to the course
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[68ch] px-6 py-10">
      <div className="mb-4 flex items-center gap-1.5" aria-hidden>
        {quiz.questions.map((q, i) => (
          <span
            key={q.id}
            className={`h-1.5 w-6 rounded-sm ${
              i === index
                ? "bg-accent-500"
                : picked[q.id] != null
                  ? "bg-ink-500"
                  : "bg-ink-100"
            }`}
          />
        ))}
      </div>

      <p className="font-mono text-[13px] text-ink-500">
        Question {index + 1} of {total}
      </p>
      <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink-900">
        {question.prompt}
      </h1>

      <fieldset className="mt-4 flex flex-col gap-2">
        {question.options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 text-[15px] ${
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
            />
            {o.text}
          </label>
        ))}
      </fieldset>

      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

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
