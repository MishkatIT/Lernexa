"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { courseSchema, type LessonProgressionMode } from "@/lib/schemas";
import { createCourse, updateCourse, type ActionResult } from "@/actions/courses";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

type Props = {
  mode: "create" | "edit";
  documentId?: string;
  initial?: {
    title: string;
    description: string;
    coverImageUrl: string;
    lessonProgression: LessonProgressionMode;
  };
};

/** Wording is straight from the spec — keep the three options and their
 *  one-line explanations in sync with the backend enum (D-038). */
const PROGRESSION_OPTIONS: {
  value: LessonProgressionMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "free",
    label: "Free progression",
    hint: "Students can view and complete lessons in any order.",
  },
  {
    value: "complete_locked",
    label: "Lock completing only",
    hint: "Students can view lessons, but must complete previous lessons before completing the next one.",
  },
  {
    value: "open_locked",
    label: "Lock opening too",
    hint: "Students must complete previous lessons before opening later lessons.",
  },
];

export function CourseForm({ mode, documentId, initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);

  const initialProgression: LessonProgressionMode =
    initial?.lessonProgression ?? "free";

  /** Uncontrolled form — recompute "has anything changed" on every edit so the
   *  Save button only lights up when there's something to save. */
  function onChange(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    setDirty(
      (fd.get("title") ?? "") !== (initial?.title ?? "") ||
        (fd.get("description") ?? "") !== (initial?.description ?? "") ||
        (fd.get("coverImageUrl") ?? "") !== (initial?.coverImageUrl ?? "") ||
        (fd.get("lessonProgression") ?? "free") !== initialProgression,
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const parsed = courseSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description") ?? "",
      coverImageUrl: fd.get("coverImageUrl") ?? "",
      lessonProgression: fd.get("lessonProgression") ?? "free",
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }
    setErrors({});
    setPending(true);

    const res: ActionResult =
      mode === "create"
        ? await createCourse(parsed.data)
        : await updateCourse(documentId!, parsed.data);

    if (!res.ok) {
      setPending(false);
      setFormError(res.error);
      return;
    }
    toast(mode === "create" ? "Course created" : "Course saved");
    if (mode === "create" && res.documentId) {
      // New course: move to its edit page. Editing stays put so the
      // instructor can keep working through the other sections.
      router.push(`/manage/courses/${res.documentId}`);
    } else {
      setPending(false);
      setDirty(false);
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      onChange={onChange}
      noValidate
      className="flex max-w-xl flex-col gap-4"
    >
      {formError ? <Alert>{formError}</Alert> : null}
      <Input label="Title" name="title" defaultValue={initial?.title} error={errors.title} />
      <Textarea
        label="Description"
        name="description"
        defaultValue={initial?.description}
        error={errors.description}
      />
      <Input
        label="Cover image URL"
        name="coverImageUrl"
        defaultValue={initial?.coverImageUrl}
        placeholder="https://…"
        error={errors.coverImageUrl}
      />

      <fieldset className="mt-2 flex flex-col gap-3">
        <legend className="text-small font-medium text-ink-700">
          How should students progress through lessons?
        </legend>
        <div className="flex flex-col gap-2">
          {PROGRESSION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex gap-3 rounded-md border border-ink-200 p-3 text-body has-[:checked]:border-accent-500 has-[:checked]:bg-accent-100/40"
            >
              <input
                type="radio"
                name="lessonProgression"
                value={opt.value}
                defaultChecked={opt.value === initialProgression}
                className="mt-1 h-4 w-4 shrink-0 accent-accent-600"
              />
              <span className="flex flex-col">
                <span className="font-medium text-ink-900">{opt.label}</span>
                <span className="text-small text-ink-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.lessonProgression ? (
          <p className="text-small text-danger">{errors.lessonProgression}</p>
        ) : null}
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || (mode === "edit" && !dirty)}>
          {pending ? "Saving…" : mode === "create" ? "Create course" : "Save changes"}
        </Button>
        {mode === "create" || dirty ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/manage/courses")}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
