"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishPost, unpublishPost, deletePost } from "@/actions/blog";
import { Button } from "@/components/ui/Button";

export function PostRowActions({
  documentId,
  title,
  published,
}: {
  documentId: string;
  title: string;
  published: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed");
    router.refresh();
  }

  return (
    <span className="flex items-center gap-1">
      {error ? <span className="mr-2 text-[12px] text-danger">{error}</span> : null}
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() =>
          run(() => (published ? unpublishPost(documentId) : publishPost(documentId)))
        }
      >
        {published ? "Unpublish" : "Publish"}
      </Button>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => {
          if (confirm(`Delete “${title}”?`)) run(() => deletePost(documentId));
        }}
      >
        Delete
      </Button>
    </span>
  );
}
