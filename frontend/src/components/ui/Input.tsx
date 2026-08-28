"use client";

import { useId } from "react";
import type { ComponentPropsWithRef } from "react";

type Props = ComponentPropsWithRef<"input"> & {
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
      <label htmlFor={inputId} className="text-small font-medium text-ink-700">
        {label}
      </label>
      <input
        id={inputId}
        className={`h-10 rounded-md border bg-paper-raised px-3 text-body text-ink-900 outline-none focus:ring-2 focus:ring-accent-500 ${
          error ? "border-danger" : "border-ink-200"
        } ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
