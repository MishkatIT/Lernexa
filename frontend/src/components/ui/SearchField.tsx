"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-driven search box. Typing is debounced (default 350ms) and then written
 * to the `q` query param via `router.replace` — the server component re-renders
 * with the new `searchParams`, so the search runs in Strapi as a WHERE clause,
 * never as a client-side filter over one page. Any `page` param is dropped so a
 * new search always starts at page 1.
 *
 * No form, no submit button: the URL is the state. Deep-linking `?q=react`
 * works, back/forward works, and the field stays in sync if the param changes
 * elsewhere.
 */
export function SearchField({
  paramName = "q",
  placeholder = "Search…",
  label = "Search",
  debounceMs = 350,
  className = "",
}: {
  paramName?: string;
  placeholder?: string;
  label?: string;
  debounceMs?: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(urlValue);
  const [syncedFrom, setSyncedFrom] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust the input when the param changes elsewhere (a "Clear" link,
  // browser back/forward) — the render-phase "derive state from props" pattern,
  // not an effect.
  if (urlValue !== syncedFrom) {
    setSyncedFrom(urlValue);
    setValue(urlValue);
  }

  function push(next: string) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    const trimmed = next.trim();
    if (trimmed) params.set(paramName, trimmed);
    else params.delete(paramName);
    params.delete("page"); // a new query resets pagination
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), debounceMs);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (timer.current) clearTimeout(timer.current);
    push(value);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <form onSubmit={onSubmit} className={className} role="search">
      <label className="block text-small font-medium text-ink-700">
        {label}
        <span className="relative mt-1 block">
          <input
            type="search"
            name={paramName}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-9 w-full rounded-md border border-ink-200 bg-paper-raised px-3 pr-8 text-body text-ink-900 outline-none placeholder:text-ink-500/70 focus:ring-2 focus:ring-accent-500"
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-ink-200 border-t-accent-500 transition-opacity ${
              isPending ? "animate-spin opacity-100" : "opacity-0"
            }`}
          />
        </span>
      </label>
    </form>
  );
}
