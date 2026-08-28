import Link from "next/link";

/**
 * Prev / page-of / Next. Server-rendered links only — no client JS. `makeHref`
 * builds the URL for a target page (callers preserve their own query params).
 */
export function Pagination({
  page,
  pageCount,
  makeHref,
  className = "",
}: {
  page: number;
  pageCount: number;
  makeHref: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center gap-4 text-small ${className}`}
    >
      {page > 1 ? (
        <Link
          href={makeHref(page - 1)}
          rel="prev"
          className="text-accent-600 hover:underline"
        >
          ← Prev
        </Link>
      ) : (
        <span className="text-ink-500/50">← Prev</span>
      )}
      <span className="text-ink-500">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={makeHref(page + 1)}
          rel="next"
          className="text-accent-600 hover:underline"
        >
          Next →
        </Link>
      ) : (
        <span className="text-ink-500/50">Next →</span>
      )}
    </nav>
  );
}
