import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const tones: Record<Tone, string> = {
  // Neutral = the default for role badges: an ink outline, never a coloured pill.
  neutral: "border-ink-200 text-ink-700",
  success: "border-success/45 text-success",
  warning: "border-warning/45 text-warning",
  danger: "border-danger/45 text-danger",
  accent: "border-accent-500/50 text-accent-600",
};

/**
 * Small status/label pill. Role badges use `neutral` (ink outline); status
 * badges (Published, Blocked, Draft) carry semantic colour.
 */
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-small font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
