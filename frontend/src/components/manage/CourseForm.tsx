"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { courseSchema } from "@/lib/schemas";
import { createCourse, updateCourse, type ActionResult } from "@/actions/courses";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

type Props = {
  mode: "create" | "edit";
  documentId?: string;
  initial?: { title: string; description: string; coverImageUrl: string };
};

export function CourseForm({ mode, documentId, initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const parsed = courseSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description") ?? "",
      coverImageUrl: fd.get("coverImageUrl") ?? "",
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
    router.push(
      mode === "create" && res.documentId
        ? `/manage/courses/${res.documentId}`
        : "/manage/courses",
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
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
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create course" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/manage/courses")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
