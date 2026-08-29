"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The users list filter bar — a debounced text search plus role/status selects,
 * all driven straight into the URL query string. The server component reruns the
 * Strapi query, so results (and the `total` count) always reflect the full
 * filtered set across every page, and changing any filter resets to page 1.
 */
const ROLE_OPTIONS = [
  ["", "Any role"],
  ["admin", "Admin"],
  ["content-manager", "Content Manager"],
  ["instructor", "Instructor"],
  ["student", "Student"],
] as const;

const STATUS_OPTIONS = [
  ["", "Any status"],
  ["active", "Active"],
  ["blocked", "Blocked"],
] as const;

export function UsersFilters({ basePath = "/admin/users" }: { basePath?: string }) {
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
    searchParams.get("q") || searchParams.get("role") || searchParams.get("status"),
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
            placeholder="Name or email"
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
        Role
        <select
          value={searchParams.get("role") ?? ""}
          onChange={(e) => apply({ role: e.target.value })}
          className="mt-1 block h-9 rounded-md border border-ink-200 bg-paper-raised px-2 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500"
        >
          {ROLE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-small font-medium text-ink-700">
        Status
        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => apply({ status: e.target.value })}
          className="mt-1 block h-9 rounded-md border border-ink-200 bg-paper-raised px-2 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500"
        >
          {STATUS_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
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
