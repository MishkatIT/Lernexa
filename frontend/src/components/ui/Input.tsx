"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

/** Label always visible (no placeholder-as-label). 1px ink border, 2px marigold
 *  focus ring, error text below in danger — docs/DESIGN_SYSTEM.md. */
export function Input({ label, error, id, className = "", ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink-700">
        {label}
      </label>
      <input
        id={inputId}
        className={`h-10 rounded-sm border bg-paper-raised px-3 text-[15px] text-ink-900 outline-none focus:ring-2 focus:ring-accent-500 ${
          error ? "border-danger" : "border-ink-200"
        } ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
