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
}: {
  courseId: string;
  lesson: LearnLesson;
  prevId: string | null;
  nextId: string | null;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(lesson.completed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
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
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10">
      <p className="font-mono text-[13px] text-ink-500">Lesson {lesson.order}</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-ink-900">
        {lesson.title}
      </h1>

      {lesson.videoUrl ? (
        <p className="mt-4">
          <a
            href={lesson.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent-600 underline"
          >
            Watch the video ↗
          </a>
        </p>
      ) : null}

      {lesson.content ? (
        <div className="mt-6 whitespace-pre-wrap font-serif text-[18px] leading-[1.7] text-ink-900">
          {lesson.content}
        </div>
      ) : (
        <p className="mt-6 text-[15px] text-ink-500">
          This lesson has no written content.
        </p>
      )}

      {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-ink-200 pt-6">
        {prevId ? (
          <Button
            variant="secondary"
            onClick={() => router.push(`/learn/${courseId}/${prevId}`)}
          >
            ← Previous
          </Button>
        ) : (
          <span />
        )}

        <Button
          onClick={toggle}
          disabled={pending}
          variant={completed ? "secondary" : "primary"}
        >
          {completed ? "Completed ✓ — Undo" : "Mark complete"}
        </Button>

        {nextId ? (
          <Button
            variant="secondary"
            onClick={() => router.push(`/learn/${courseId}/${nextId}`)}
          >
            Next →
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => router.push(`/courses/${courseId}`)}
          >
            Back to course
          </Button>
        )}
      </div>
    </div>
  );
}
