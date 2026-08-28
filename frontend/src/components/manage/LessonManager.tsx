"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lessonSchema } from "@/lib/schemas";
import {
  createLesson,
  updateLesson,
  deleteLesson,
} from "@/actions/lessons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

export type ManagedLesson = {
  documentId: string;
  title: string;
  order: number;
  content: string;
  videoUrl: string;
};

type Draft = { title: string; order: string; content: string; videoUrl: string };

const emptyDraft = (order: number): Draft => ({
  title: "",
  order: String(order),
  content: "",
  videoUrl: "",
});

export function LessonManager({
  courseDocumentId,
  lessons,
}: {
  courseDocumentId: string;
  lessons: ManagedLesson[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextOrder = (lessons.at(-1)?.order ?? 0) + 1;

  async function submitDraft(draft: Draft, docId?: string) {
    setError(null);
    const parsed = lessonSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the fields");
      return;
    }
    setBusy(true);
    const res = docId
      ? await updateLesson(docId, courseDocumentId, parsed.data)
      : await createLesson(courseDocumentId, parsed.data);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast(docId ? "Lesson saved" : "Lesson added");
    setEditing(null);
    setAdding(false);
    router.refresh();
  }

  async function remove(docId: string) {
    setError(null);
    setBusy(true);
    const res = await deleteLesson(docId, courseDocumentId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast("Lesson deleted");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert>{error}</Alert> : null}

      {lessons.length === 0 && !adding ? (
        <p className="text-body text-ink-500">
          No lessons yet. A course with no lessons stays out of the public
          catalogue.
        </p>
      ) : null}

      <ol className="flex flex-col gap-2">
        {lessons.map((lesson) =>
          editing === lesson.documentId ? (
            <li key={lesson.documentId} className="rounded-md border border-ink-200 p-4">
              <LessonFields
                initial={{
                  title: lesson.title,
                  order: String(lesson.order),
                  content: lesson.content,
                  videoUrl: lesson.videoUrl,
                }}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSubmit={(d) => submitDraft(d, lesson.documentId)}
                submitLabel="Save lesson"
              />
            </li>
          ) : (
            <li
              key={lesson.documentId}
              className="flex items-center justify-between gap-3 rounded-md border border-ink-200 bg-paper-raised px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-small text-ink-500">
                  {String(lesson.order).padStart(2, "0")}
                </span>
                <span className="truncate text-body text-ink-900">
                  {lesson.title}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(lesson.documentId)}
                  disabled={busy}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(lesson.documentId)}
                  disabled={busy}
                >
                  Delete
                </Button>
              </span>
            </li>
          ),
        )}
      </ol>

      {adding ? (
        <div className="rounded-md border border-ink-200 p-4">
          <LessonFields
            initial={emptyDraft(nextOrder)}
            busy={busy}
            onCancel={() => setAdding(false)}
            onSubmit={(d) => submitDraft(d)}
            submitLabel="Add lesson"
          />
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setAdding(true)} disabled={busy}>
            Add a lesson
          </Button>
        </div>
      )}
    </div>
  );
}

function LessonFields({
  initial,
  busy,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  initial: Draft;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (draft: Draft) => void;
  submitLabel: string;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <Input label="Title" value={draft.title} onChange={set("title")} />
        </div>
        <div className="w-24">
          <Input label="Order" type="number" min={1} value={draft.order} onChange={set("order")} />
        </div>
      </div>
      <Textarea
        label="Content (text)"
        value={draft.content}
        onChange={set("content")}
      />
      <Input
        label="Video URL"
        value={draft.videoUrl}
        onChange={set("videoUrl")}
        placeholder="https://…"
      />
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
