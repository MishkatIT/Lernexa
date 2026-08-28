"use client";

import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  /** Hide the label visually but keep it for screen readers (compact toolbars). */
  hideLabel?: boolean;
};

/** Matches Input: label always present, 1px ink border, 2px marigold focus ring. */
export function Select({
  label,
  error,
  hideLabel = false,
  id,
  className = "",
  children,
  ...props
}: Props) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className={
          hideLabel
            ? "sr-only"
            : "text-small font-medium text-ink-700"
        }
      >
        {label}
      </label>
      <select
        id={selectId}
        className={`h-10 rounded-md border bg-paper-raised px-3 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500 ${
          error ? "border-danger" : "border-ink-200"
        } ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
