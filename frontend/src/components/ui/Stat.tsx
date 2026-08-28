import type { ReactNode } from "react";

/** A single metric: a confident number and a quiet label. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[1.75rem] leading-none tracking-tight text-ink-900">
        {value}
      </div>
      <div className="mt-2 text-small text-ink-500">{label}</div>
      {hint ? <div className="text-small text-ink-500/80">{hint}</div> : null}
    </div>
  );
}
