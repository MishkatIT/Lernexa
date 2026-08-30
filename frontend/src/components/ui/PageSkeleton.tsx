import { Container } from "@/components/ui/Container";

/**
 * Route-level loading fallbacks, shared so every data-fetching segment gets an
 * instant paint on click (and becomes partially prefetchable) without a bespoke
 * skeleton per route. Three shapes cover the app:
 *
 *  - `SectionIndexSkeleton` — the eyebrow / title / stat-row / list stack used
 *    across `/manage` and `/admin`.
 *  - `CatalogueSkeleton` — public `Container` pages: a title block then either a
 *    card grid (`variant="grid"`) or a single reading column (`"detail"`).
 *  - `ReadingSkeleton` — the narrow long-form column for `/learn`.
 */

const bar = "rounded bg-ink-100";

export function SectionIndexSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className={`h-3 w-20 ${bar}`} />
      <div className={`mt-3 h-8 w-72 ${bar}`} />
      <div className={`mt-3 h-4 w-96 max-w-full opacity-70 ${bar}`} />

      <div className="mt-6 grid grid-cols-2 gap-6 border-y border-ink-200 py-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className={`h-7 w-12 ${bar}`} />
            <div className={`mt-2 h-3 w-16 opacity-70 ${bar}`} />
          </div>
        ))}
      </div>

      <div className={`mt-10 h-5 w-40 ${bar}`} />
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-lg border border-ink-200 bg-ink-100/40"
          />
        ))}
      </div>
    </div>
  );
}

export function CatalogueSkeleton({
  variant = "grid",
  size = "page",
}: {
  variant?: "grid" | "detail";
  size?: "page" | "content";
}) {
  return (
    <Container size={size} className="animate-pulse py-10 sm:py-14">
      <div className={`h-3 w-24 ${bar}`} />
      <div className={`mt-2 h-9 w-64 max-w-full ${bar}`} />
      <div className={`mt-3 h-4 w-80 max-w-full opacity-70 ${bar}`} />

      {variant === "grid" ? (
        <>
          <div className={`mt-6 h-9 w-full max-w-sm ${bar}`} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-ink-200 p-5">
                <div className={`h-5 w-3/4 ${bar}`} />
                <div className={`mt-2 h-3 w-24 opacity-70 ${bar}`} />
                <div className={`mt-4 h-3 w-full opacity-60 ${bar}`} />
                <div className={`mt-1.5 h-3 w-5/6 opacity-60 ${bar}`} />
                <div className={`mt-5 h-3 w-20 opacity-70 ${bar}`} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className={`mt-6 h-4 w-full max-w-[42rem] opacity-70 ${bar}`} />
          <div className={`mt-2 h-4 w-5/6 max-w-[42rem] opacity-70 ${bar}`} />
          <div className="mt-8 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg border border-ink-200 bg-ink-100/40"
              />
            ))}
          </div>
        </>
      )}
    </Container>
  );
}

export function ReadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[68ch] animate-pulse px-6 py-10">
      <div className={`h-4 w-16 ${bar}`} />
      <div className={`mt-2 h-8 w-2/3 ${bar}`} />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`h-4 opacity-60 ${bar}`} />
        ))}
      </div>
    </div>
  );
}
