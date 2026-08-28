"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishPost, unpublishPost, deletePost } from "@/actions/blog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

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
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMessage: string,
  ) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    toast(okMessage);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-small text-ink-500">Delete this post?</span>
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          loading={busy}
          loadingLabel="Deleting…"
          onClick={() => run(() => deletePost(documentId), "Post deleted")}
        >
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {error ? (
        <span className="mr-2 text-small text-danger">{error}</span>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() =>
          run(
            () => (published ? unpublishPost(documentId) : publishPost(documentId)),
            published ? "Post unpublished" : `“${title}” published`,
          )
        }
      >
        {published ? "Unpublish" : "Publish"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    </span>
  );
}
