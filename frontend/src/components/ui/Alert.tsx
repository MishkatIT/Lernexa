import type { ReactNode } from "react";

const tones = {
  danger: "border-danger/45 bg-danger/10 text-danger",
  success: "border-success/45 bg-success/10 text-success",
  warning: "border-warning/45 bg-warning/10 text-warning",
} as const;

/** Inline, bordered-left 3px in a semantic colour. Form-level errors, banners. */
export function Alert({
  tone = "danger",
  children,
  className = "",
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-md border border-l-[3px] px-3 py-2 text-small ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
