/**
 * Takes { completed, total } and derives the percentage. Never a `percent`
 * prop — the component can't be asked to show a number the data doesn't
 * support. Green = completed, and only that.
 */
export function ProgressBar({
  completed,
  total,
  showLabel = true,
  size = "md",
}: {
  completed: number;
  total: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${
          size === "sm" ? "h-1" : "h-1.5"
        } flex-1 overflow-hidden rounded-full bg-ink-100`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completed} of ${total} complete`}
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-9 shrink-0 text-right font-mono text-small text-ink-500">
          {percent}%
        </span>
      ) : null}
    </div>
  );
}
