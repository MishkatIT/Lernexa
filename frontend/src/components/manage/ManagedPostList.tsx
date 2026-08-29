"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PostRowActions } from "@/components/manage/PostRowActions";

type Item = {
  documentId: string;
  title: string;
  publishedAt: string | null;
};

/**
 * The managed blog list is small and unpaginated (every draft + published post
 * is already loaded), so the title filter runs in memory — instant, no round
 * trip. The public /blog list, which is paginated, searches server-side instead.
 */
export function ManagedPostList({ posts }: { posts: Item[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      needle
        ? posts.filter((p) => p.title.toLowerCase().includes(needle))
        : posts,
    [posts, needle],
  );

  return (
    <div>
      <div className="mt-5 max-w-sm">
        <label className="block text-small font-medium text-ink-700">
          Search posts
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title"
            className="mt-1 h-9 w-full rounded-md border border-ink-200 bg-paper-raised px-3 text-body text-ink-900 outline-none placeholder:text-ink-500/70 focus:ring-2 focus:ring-accent-500"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No posts match"
            description="Try a different term."
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {filtered.map((p) => (
            <li key={p.documentId}>
              <Card className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Link
                    href={`/manage/blog/${p.documentId}`}
                    className="truncate text-body font-medium text-ink-900 hover:underline"
                  >
                    {p.title}
                  </Link>
                  <Badge tone={p.publishedAt ? "success" : "neutral"}>
                    {p.publishedAt ? "Published" : "Draft"}
                  </Badge>
                </span>
                <PostRowActions
                  documentId={p.documentId}
                  title={p.title}
                  published={Boolean(p.publishedAt)}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
