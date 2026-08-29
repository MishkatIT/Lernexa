"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AUDIT_ACTIONS } from "@/lib/audit-shared";

/**
 * Audit log filter bar — debounced actor/target search plus category, event and
 * order selects, all written into the URL. The Strapi query reruns server-side,
 * so a search matches the whole log, not the page on screen, and "Showing X–Y
 * of N" tracks the filtered total.
 */
export function AuditFilters({ basePath = "/admin/audit" }: { basePath?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [syncedFrom, setSyncedFrom] = useState(urlQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render-phase sync when the param changes elsewhere (Clear link, back/forward).
  if (urlQ !== syncedFrom) {
    setSyncedFrom(urlQ);
    setQ(urlQ);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function onQ(next: string) {
    setQ(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q: next.trim() }), 350);
  }

  const hasFilters = Boolean(
    searchParams.get("q") ||
      searchParams.get("action") ||
      searchParams.get("category") ||
      searchParams.get("sort"),
  );

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3" role="search">
      <label className="block w-56 text-small font-medium text-ink-700">
        Search
        <span className="relative mt-1 block">
          <input
            type="search"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Actor or target"
            className="h-9 w-full rounded-md border border-ink-200 bg-paper-raised px-3 pr-8 text-body text-ink-900 outline-none placeholder:text-ink-500/70 focus:ring-2 focus:ring-accent-500"
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-ink-200 border-t-accent-500 ${
              isPending ? "animate-spin opacity-100" : "opacity-0"
            }`}
          />
        </span>
      </label>

      <label className="block text-small font-medium text-ink-700">
        Category
        <select
          value={searchParams.get("category") ?? ""}
          onChange={(e) => apply({ category: e.target.value })}
          className="mt-1 block h-9 rounded-md border border-ink-200 bg-paper-raised px-2 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">Any category</option>
          <option value="security">Security</option>
          <option value="content">Content</option>
          <option value="account">Account</option>
        </select>
      </label>

      <label className="block text-small font-medium text-ink-700">
        Event
        <select
          value={searchParams.get("action") ?? ""}
          onChange={(e) => apply({ action: e.target.value })}
          className="mt-1 block h-9 rounded-md border border-ink-200 bg-paper-raised px-2 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">Any event</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-small font-medium text-ink-700">
        Order
        <select
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) =>
            apply({ sort: e.target.value === "oldest" ? "oldest" : "" })
          }
          className="mt-1 block h-9 rounded-md border border-ink-200 bg-paper-raised px-2 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>

      {hasFilters ? (
        <Link
          href={basePath}
          className="pb-2 text-small text-ink-500 hover:text-ink-900"
        >
          Clear
        </Link>
      ) : null}
    </div>
  );
}
