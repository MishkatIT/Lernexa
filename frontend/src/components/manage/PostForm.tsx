"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPost, updatePost } from "@/actions/blog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

export function PostForm({
  mode,
  documentId,
  initial,
}: {
  mode: "create" | "edit";
  documentId?: string;
  initial?: { title: string; body: string; coverImageUrl: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const payload = { title, body, coverImageUrl: coverImageUrl || undefined };
    const res =
      mode === "create"
        ? await createPost(payload)
        : await updatePost(documentId!, payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast(mode === "create" ? "Draft created" : "Post saved");
    router.push(
      mode === "create" && "documentId" in res && res.documentId
        ? `/manage/blog/${res.documentId}`
        : "/manage/blog",
    );
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input
        label="Cover image URL"
        value={coverImageUrl}
        onChange={(e) => setCoverImageUrl(e.target.value)}
        placeholder="https://…"
      />
      <Textarea
        label="Body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-64 font-serif"
      />
      <div className="flex gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create draft" : "Save"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/manage/blog")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
