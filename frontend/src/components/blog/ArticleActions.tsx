"use client";

import { useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * The subtle interaction row under the title. Only what the platform can honour:
 *
 *  - reading time  — derived, shown as text
 *  - share         — Web Share API where present, clipboard fallback
 *  - bookmark      — saved in this browser's localStorage (per-device, no
 *                    server state); reflects and toggles it, and stays in sync
 *                    across tabs
 *
 * Likes / comments / follower counts would need backend the app doesn't have,
 * so they're deliberately absent rather than faked.
 */
const KEY = "lernexa.bookmarks";
const EVENT = "lernexa:bookmarks";

function readBookmarks(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeBookmarks(next: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / storage disabled — the toggle just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ArticleActions({
  slug,
  title,
  readingMinutes,
}: {
  slug: string;
  title: string;
  readingMinutes: number;
}) {
  const { toast } = useToast();
  const bookmarked = useSyncExternalStore(
    subscribe,
    () => readBookmarks().includes(slug),
    () => false, // server snapshot — nothing is bookmarked during SSR
  );

  function toggleBookmark() {
    const next = readBookmarks();
    const i = next.indexOf(slug);
    if (i >= 0) next.splice(i, 1);
    else next.push(slug);
    writeBookmarks(next);
    toast(next.includes(slug) ? "Saved to this device" : "Removed from saved");
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-small text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900";

  return (
    <div className="flex items-center gap-1 text-ink-500">
      <span className="pr-2 text-small">{readingMinutes} min read</span>
      <span aria-hidden className="mr-1 h-4 w-px bg-ink-200" />

      <button
        type="button"
        onClick={toggleBookmark}
        aria-pressed={bookmarked}
        className={btn}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M6 4h12v16l-6-4-6 4V4z"
            fill={bookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>
        {bookmarked ? "Saved" : "Save"}
      </button>

      <button type="button" onClick={share} className={btn}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v12M12 3l-4 4M12 3l4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Share
      </button>
    </div>
  );
}
