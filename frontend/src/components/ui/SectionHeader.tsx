import type { ReactNode } from "react";

/**
 * Consistent section framing: an optional eyebrow, a title, an optional
 * description, and an optional right-aligned action.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  as = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  const Title = as;
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-small font-medium uppercase tracking-[0.14em] text-ink-500">
            {eyebrow}
          </p>
        ) : null}
        <Title
          className={
            as === "h1"
              ? "text-display text-ink-900"
              : "text-h1 text-ink-900"
          }
        >
          {title}
        </Title>
        {description ? (
          <p className="mt-2 max-w-[46rem] text-body text-ink-700">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
