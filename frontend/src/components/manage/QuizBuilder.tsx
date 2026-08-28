"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCourseQuiz, deleteCourseQuiz } from "@/actions/quizzes";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import type { BuilderQuestion, ManagedQuiz } from "@/lib/quiz";

const blankQuestion = (): BuilderQuestion => ({
  prompt: "",
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
});

export function QuizBuilder({
  courseDocumentId,
  quiz,
}: {
  courseDocumentId: string;
  quiz: ManagedQuiz | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(quiz?.title ?? "Course quiz");
  const [questions, setQuestions] = useState<BuilderQuestion[]>(
    quiz?.questions.length ? quiz.questions : [blankQuestion()],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchQuestion(qi: number, next: Partial<BuilderQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...next } : q)));
  }
  function patchOption(qi: number, oi: number, text: string) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, text } : o)) }
          : q,
      ),
    );
  }
  function setCorrect(qi: number, oi: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi
          ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oi })) }
          : q,
      ),
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveCourseQuiz(courseDocumentId, quiz?.documentId ?? null, {
      title,
      questions,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast(quiz ? "Quiz saved" : "Quiz created");
    router.refresh();
  }

  async function remove() {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    const res = await deleteCourseQuiz(courseDocumentId, quiz.documentId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast("Quiz deleted");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}

      <Input
        label="Quiz title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {questions.map((q, qi) => (
        <div key={qi} className="rounded-md border border-ink-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Input
                label={`Question ${qi + 1}`}
                value={q.prompt}
                onChange={(e) => patchQuestion(qi, { prompt: e.target.value })}
              />
            </div>
            {questions.length > 1 ? (
              <button
                type="button"
                className="mt-7 text-small text-ink-500 hover:text-danger"
                onClick={() =>
                  setQuestions((qs) => qs.filter((_, i) => i !== qi))
                }
              >
                Remove
              </button>
            ) : null}
          </div>

          <fieldset className="mt-3 flex flex-col gap-2">
            <legend className="text-small font-medium text-ink-700">
              Options — mark the correct one
            </legend>
            {q.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={o.isCorrect}
                  onChange={() => setCorrect(qi, oi)}
                  aria-label={`Option ${oi + 1} is correct`}
                  className="h-4 w-4 accent-accent-600"
                />
                <input
                  className="h-9 flex-1 rounded-md border border-ink-200 bg-paper-raised px-2.5 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500"
                  value={o.text}
                  placeholder={`Option ${oi + 1}`}
                  onChange={(e) => patchOption(qi, oi, e.target.value)}
                />
                {q.options.length > 2 ? (
                  <button
                    type="button"
                    className="px-1 text-small text-ink-500 hover:text-danger"
                    aria-label={`Remove option ${oi + 1}`}
                    onClick={() =>
                      patchQuestion(qi, {
                        options: q.options.filter((_, j) => j !== oi),
                      })
                    }
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="self-start text-small text-accent-600 hover:underline"
              onClick={() =>
                patchQuestion(qi, {
                  options: [...q.options, { text: "", isCorrect: false }],
                })
              }
            >
              + option
            </button>
          </fieldset>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
        >
          Add question
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : quiz ? "Save quiz" : "Create quiz"}
        </Button>
        {quiz ? (
          <Button variant="ghost" onClick={remove} disabled={busy}>
            Delete quiz
          </Button>
        ) : null}
      </div>
    </div>
  );
}
