"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishPost, unpublishPost } from "@/actions/blog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { LivePublishState } from "@/lib/blog-status";

const PUBLISH_LABEL: Record<LivePublishState["state"], string | null> = {
  live: null, // draft already matches live — nothing to push
  modified: "Publish changes",
  never_published: "Publish",
  unpublished: "Re-publish",
};

/**
 * Publish / unpublish controls on the post editor. Edits save to the draft only
 * (actions/blog.ts `updatePost` uses `?status=draft`), so this is how a change
 * actually reaches — or leaves — readers without a trip back to the blog list.
 */
export function PostLiveControls({
  documentId,
  state,
}: {
  documentId: string;
  state: LivePublishState["state"];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"publish" | "unpublish" | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const busy = pending !== null || refreshing;

  const publishLabel = PUBLISH_LABEL[state];
  const isLive = state === "live" || state === "modified";

  async function run(
    kind: "publish" | "unpublish",
    okMessage: string,
  ) {
    setPending(kind);
    setError(null);
    const res =
      kind === "publish"
        ? await publishPost(documentId)
        : await unpublishPost(documentId);
    setPending(null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    toast(okMessage);
    startRefresh(() => router.refresh());
  }

  if (!publishLabel && !isLive) return null;

  return (
    <span className="flex items-center gap-2">
      {publishLabel ? (
        <Button
          size="sm"
          disabled={busy}
          loading={pending === "publish"}
          loadingLabel="Publishing…"
          onClick={() => run("publish", "Changes are live")}
        >
          {publishLabel}
        </Button>
      ) : null}
      {isLive ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          loading={pending === "unpublish"}
          loadingLabel="Unpublishing…"
          onClick={() => run("unpublish", "Post unpublished")}
        >
          Unpublish
        </Button>
      ) : null}
      {error ? <span className="text-small text-danger">{error}</span> : null}
    </span>
  );
}
