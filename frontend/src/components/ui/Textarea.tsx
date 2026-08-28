"use client";

import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export function Textarea({ label, error, id, className = "", ...props }: Props) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-ink-700">
        {label}
      </label>
      <textarea
        id={fieldId}
        className={`min-h-24 rounded-sm border bg-paper-raised px-3 py-2 text-[15px] text-ink-900 outline-none focus:ring-2 focus:ring-accent-500 ${
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
