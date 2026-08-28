import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Icon-free. Explains what happened and offers the next action. An empty
 * database should never read as a broken page (docs/DESIGN_SYSTEM.md).
 */
export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description: ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-ink-200 bg-paper-raised/60 px-6 py-12 text-center ${className}`}
    >
      <p className="text-h3 text-ink-900">{title}</p>
      <p className="mx-auto mt-2 max-w-[34rem] text-body text-ink-700">
        {description}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-9 items-center rounded-md bg-accent-600 px-4 text-small font-medium text-on-accent transition-colors hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
