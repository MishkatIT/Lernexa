"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CATEGORIES } from "@/lib/blog-categories";

/**
 * Horizontal topic strip. The feed is server-filtered, but switching topics is a
 * client-side transition (same pattern as `SearchField`): `router.push` inside a
 * transition so the current feed stays on screen — dimmed, not blanked — while
 * the next one loads, and the tapped chip reacts immediately. Falls back to a
 * plain `<Link>` navigation without JS and for modifier-clicks.
 *
 * Scrolls sideways on narrow screens rather than wrapping into a block.
 */
export function CategoryBar({
  counts,
}: {
  counts?: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const active = searchParams.get("category") ?? "";
  const q = searchParams.get("q");

  const items = [{ slug: "", label: "All" }, ...CATEGORIES];

  const hrefFor = (slug: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (slug) params.set("category", slug);
    // No `page` — switching topic always restarts at page 1.
    const s = params.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <nav
      aria-label="Topics"
      aria-busy={isPending || undefined}
      className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max items-center gap-1.5">
        {items.map((c) => {
          const isActive = active === c.slug;
          const href = hrefFor(c.slug);
          const count = c.slug ? counts?.[c.slug] : undefined;
          const isChipPending = isPending && pendingSlug === c.slug;
          return (
            <li key={c.slug || "all"}>
              <Link
                href={href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => {
                  // Let the browser handle new-tab / download / non-primary clicks.
                  if (
                    e.metaKey ||
                    e.ctrlKey ||
                    e.shiftKey ||
                    e.altKey ||
                    e.button !== 0
                  ) {
                    return;
                  }
                  e.preventDefault();
                  if (isActive) return;
                  setPendingSlug(c.slug);
                  startTransition(() => router.push(href));
                }}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-small transition-colors ${
                  isActive
                    ? "border-ink-900 bg-ink-900 text-paper-raised"
                    : "border-ink-200 text-ink-700 hover:border-ink-500 hover:text-ink-900"
                } ${isPending && !isActive ? "opacity-60" : ""}`}
              >
                {c.label}
                {isChipPending ? (
                  <span
                    aria-hidden
                    className={`h-3 w-3 animate-spin rounded-full border-2 ${
                      isActive
                        ? "border-paper-raised/40 border-t-paper-raised"
                        : "border-ink-200 border-t-ink-700"
                    }`}
                  />
                ) : typeof count === "number" && count > 0 ? (
                  <span
                    className={isActive ? "text-paper-raised/70" : "text-ink-500"}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
