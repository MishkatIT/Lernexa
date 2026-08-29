import Link from "next/link";
import { CATEGORIES } from "@/lib/blog-categories";

/**
 * Horizontal topic strip. Plain links to `/blog?category=<slug>` — the feed is
 * server-filtered, so this needs no client JS. Scrolls sideways on narrow
 * screens rather than wrapping into a block.
 */
export function CategoryBar({
  active,
  counts,
}: {
  active?: string | null;
  counts?: Record<string, number>;
}) {
  const items = [{ slug: "", label: "All" }, ...CATEGORIES];

  return (
    <nav
      aria-label="Topics"
      className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max items-center gap-1.5">
        {items.map((c) => {
          const isActive = (active ?? "") === c.slug;
          const href = c.slug ? `/blog?category=${c.slug}` : "/blog";
          const count = c.slug ? counts?.[c.slug] : undefined;
          return (
            <li key={c.slug || "all"}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-small transition-colors ${
                  isActive
                    ? "border-ink-900 bg-ink-900 text-paper-raised"
                    : "border-ink-200 text-ink-700 hover:border-ink-500 hover:text-ink-900"
                }`}
              >
                {c.label}
                {typeof count === "number" && count > 0 ? (
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
