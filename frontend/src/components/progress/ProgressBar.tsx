/**
 * Takes { completed, total } and derives the percentage. Never a `percent`
 * prop — the component can't be asked to show a number the data doesn't
 * support (docs/DESIGN_SYSTEM.md). Green = completed, and only that.
 */
export function ProgressBar({
  completed,
  total,
  showLabel = true,
}: {
  completed: number;
  total: number;
  showLabel?: boolean;
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1 flex-1 rounded-sm bg-ink-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completed} of ${total} lessons complete`}
      >
        <div
          className="h-full rounded-sm bg-success transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel ? (
        <span className="w-10 shrink-0 text-right font-mono text-[13px] text-ink-500">
          {percent}%
        </span>
      ) : null}
    </div>
  );
}
