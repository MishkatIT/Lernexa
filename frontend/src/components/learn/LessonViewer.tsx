"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markLessonComplete,
  unmarkLessonComplete,
} from "@/actions/learning";
import { Button } from "@/components/ui/Button";
import type { LearnLesson } from "@/lib/learning";

export function LessonViewer({
  courseId,
  lesson,
  prevId,
  nextId,
  quizId,
}: {
  courseId: string;
  lesson: LearnLesson;
  prevId: string | null;
  nextId: string | null;
  quizId: string | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(lesson.completed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // D-038 progression gate. `locked` (open_locked) hides the body; `!canComplete`
  // (complete_locked) shows it but blocks completion. An already-completed lesson
  // is always actionable so the student can still undo it. The server enforces
  // the same rule — this only keeps the UI honest.
  const gated = !completed && (lesson.locked || !lesson.canComplete);

  function toggle() {
    if (gated) return;
    const target = !completed;
    setCompleted(target); // optimistic
    setError(null);
    startTransition(async () => {
      const res = target
        ? await markLessonComplete(lesson.id, courseId)
        : await unmarkLessonComplete(lesson.id, courseId);
      if (!res.ok) {
        setCompleted(!target); // rollback
        setError(res.error);
        return;
      }
      router.refresh();
      if (target && nextId) router.push(`/learn/${courseId}/${nextId}`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[44rem] px-6 py-12 sm:py-16">
      <p className="font-mono text-small text-ink-500">Lesson {lesson.order}</p>
      <h1 className="mt-1.5 text-display text-ink-900">{lesson.title}</h1>

      {lesson.locked ? (
        <div className="mt-7 rounded-md border border-ink-200 bg-paper-raised p-5">
          <p className="text-body font-medium text-ink-900">🔒 Lesson locked</p>
          <p className="mt-1 text-small text-ink-500">
            {lesson.lockHint ??
              "Complete the earlier lessons to unlock this one."}
          </p>
        </div>
      ) : (
        <>
          {lesson.videoUrl ? (
            <p className="mt-5">
              <a
                href={lesson.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-body text-accent-600 underline decoration-accent-600/40 underline-offset-2 hover:decoration-accent-600"
              >
                Watch the video ↗
              </a>
            </p>
          ) : null}

          {lesson.content ? (
            <div className="mt-7 whitespace-pre-wrap font-serif text-reading text-ink-900">
              {lesson.content}
            </div>
          ) : (
            <p className="mt-7 text-body text-ink-500">
              This lesson has no written content.
            </p>
          )}

          {!completed && !lesson.locked && !lesson.canComplete ? (
            <p className="mt-6 rounded-md border border-ink-200 bg-paper-raised px-4 py-3 text-small text-ink-500">
              {lesson.lockHint ??
                "Complete the earlier lessons before completing this one."}
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p className="mt-5 text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-12 flex items-center justify-between gap-3 border-t border-ink-200 pt-6">
        {prevId ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/learn/${courseId}/${prevId}`)}
          >
            ← Previous
          </Button>
        ) : (
          <span />
        )}

        <Button
          onClick={toggle}
          loading={pending}
          loadingLabel="Saving…"
          disabled={gated}
          variant={completed ? "secondary" : "primary"}
        >
          {completed
            ? "Completed ✓ · Undo"
            : lesson.locked
              ? "Locked"
              : !lesson.canComplete
                ? "Complete earlier lessons first"
                : "Mark complete"}
        </Button>

        {nextId ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/learn/${courseId}/${nextId}`)}
          >
            Next →
          </Button>
        ) : quizId ? (
          <Button
            size="sm"
            onClick={() => router.push(`/learn/${courseId}/quiz/${quizId}`)}
          >
            Take the quiz →
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/courses/${courseId}`)}
          >
            Back to course
          </Button>
        )}
      </div>
    </div>
  );
}
