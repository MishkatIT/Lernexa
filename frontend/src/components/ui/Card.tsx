import type { ElementType, ReactNode } from "react";

/**
 * Cards are integrated into the page, not floating above it: a 1px border and a
 * tonal step, no shadow. `interactive` adds the hover treatment for cards that
 * are links.
 */
export function Card({
  as: Tag = "div",
  interactive = false,
  className = "",
  children,
  ...rest
}: {
  as?: ElementType;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag
      data-surface
      className={`rounded-lg border border-ink-200 bg-paper-raised ${
        interactive
          ? "transition-colors duration-150 hover:border-ink-500"
          : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
