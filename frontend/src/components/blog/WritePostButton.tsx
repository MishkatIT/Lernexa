"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The blog masthead's "Write a post" action. The page used to read the session
 * server-side just to decide whether to show this, which forced `/blog` to
 * render per request. It's now a client check (`GET /api/auth/me`) so the page's
 * render depends only on the URL — cached data + `searchParams` — and stays
 * cheap. The link is a convenience; `/manage/blog/new` is still auth-gated
 * server-side.
 */
const WRITERS = new Set(["admin", "content-manager"]);

export function WritePostButton() {
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: { role?: string | null } | null }) => {
        if (alive) setCanWrite(WRITERS.has(d.user?.role ?? ""));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!canWrite) return null;

  return (
    <Link
      href="/manage/blog/new"
      className="inline-flex h-10 shrink-0 items-center rounded-md bg-ink-900 px-4 text-small font-medium text-paper-raised transition-opacity hover:opacity-90"
    >
      Write a post
    </Link>
  );
}
