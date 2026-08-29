import { Container } from "@/components/ui/Container";

/**
 * Route-level fallback for the blog index. Its real value is enabling partial
 * prefetching of this (dynamic) route, so a `<Link>` to `/blog?category=…` can
 * navigate instantly. Soft transitions from the topic bar keep the live feed on
 * screen instead and never show this.
 */
export default function Loading() {
  return (
    <Container size="wide" className="animate-pulse py-10 sm:py-14">
      {/* Masthead */}
      <div className="border-b border-ink-200 pb-8">
        <div className="h-9 w-72 rounded bg-ink-100 sm:h-11" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-ink-100/70" />
        <div className="mt-6 h-9 w-full max-w-sm rounded-md bg-ink-100" />
      </div>

      {/* Topic bar */}
      <div className="mt-6 flex gap-1.5 overflow-hidden">
        {[64, 92, 84, 120, 76, 80].map((w, i) => (
          <div
            key={i}
            className="h-8 shrink-0 rounded-full bg-ink-100"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Feed */}
      <div className="mt-10 divide-y divide-ink-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-6 py-8">
            <div className="min-w-0 flex-1">
              <div className="h-3 w-20 rounded bg-ink-100/70" />
              <div className="mt-2 h-6 w-3/4 rounded bg-ink-100" />
              <div className="mt-3 h-4 w-full rounded bg-ink-100/60" />
              <div className="mt-1.5 h-4 w-5/6 rounded bg-ink-100/60" />
              <div className="mt-4 h-3 w-40 rounded bg-ink-100/70" />
            </div>
            <div className="hidden h-28 w-40 shrink-0 rounded-md bg-ink-100 sm:block md:h-32 md:w-52" />
          </div>
        ))}
      </div>
    </Container>
  );
}
