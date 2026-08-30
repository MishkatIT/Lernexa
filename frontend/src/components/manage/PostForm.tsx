"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPost, updatePost } from "@/actions/blog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { useUnsavedChanges } from "@/components/site/UnsavedChangesGuard";
import { CATEGORIES } from "@/lib/blog-categories";

export function PostForm({
  mode,
  documentId,
  initial,
}: {
  mode: "create" | "edit";
  documentId?: string;
  initial?: {
    title: string;
    body: string;
    coverImageUrl: string;
    subtitle?: string;
    category?: string;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dirty = a field differs from what the server last gave us. After a save the
  // parent server component refreshes and passes the new `initial`, so this
  // flips back to false on its own.
  const dirty =
    !busy &&
    (title !== (initial?.title ?? "") ||
      subtitle !== (initial?.subtitle ?? "") ||
      category !== (initial?.category ?? "") ||
      body !== (initial?.body ?? "") ||
      coverImageUrl !== (initial?.coverImageUrl ?? ""));
  const { confirmLeave } = useUnsavedChanges(dirty);

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      title,
      body,
      subtitle: subtitle.trim() || undefined,
      category: category || undefined,
      coverImageUrl: coverImageUrl || undefined,
    };
    const res =
      mode === "create"
        ? await createPost(payload)
        : await updatePost(documentId!, payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (mode === "create" && "documentId" in res && res.documentId) {
      toast("Draft created");
      router.push(`/manage/blog/${res.documentId}`);
      router.refresh();
      return;
    }
    // Edit: stay on the page so the editor can keep working and see the
    // refreshed draft-vs-live state. `refresh()` re-runs the server component,
    // which re-reads `post.live` and updates the badge + publish control.
    toast("Post saved");
    router.refresh();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input
        label="Subtitle"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        placeholder="One line shown under the title and in the feed (optional)"
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="post-category"
          className="text-small font-medium text-ink-700"
        >
          Category
        </label>
        <select
          id="post-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-md border border-ink-200 bg-paper-raised px-2.5 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">No category</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Cover image URL"
        value={coverImageUrl}
        onChange={(e) => setCoverImageUrl(e.target.value)}
        placeholder="https://…"
      />
      <Textarea
        label="Body (Markdown)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-64 font-serif"
      />
      <p className="-mt-2 text-small text-ink-500">
        Markdown is supported — headings, <code>`code`</code>, fenced code blocks,
        &gt; blockquotes, lists, and ![alt](image-url).
      </p>
      <div className="flex gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create draft" : "Save"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirmLeave()) router.push("/manage/blog");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
