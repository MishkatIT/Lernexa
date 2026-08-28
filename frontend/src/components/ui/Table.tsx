import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/**
 * Table per DESIGN_SYSTEM.md: header in ink-500 small-caps, quiet zebra via
 * --paper, mono for ids/dates (caller adds `font-mono`), row actions
 * right-aligned. Always horizontally scrollable on narrow screens — never a
 * card-stack fallback, which breaks scanning.
 */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-body">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-ink-200 text-left text-small uppercase tracking-[0.08em] text-ink-500">
        {children}
      </tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-ink-200 last:border-0 odd:bg-paper/50">
      {children}
    </tr>
  );
}

export function Th({
  className = "",
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th
      className={`px-3 py-2.5 font-medium first:pl-4 last:pr-4 ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  className = "",
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td
      className={`px-3 py-3 align-middle text-ink-900 first:pl-4 last:pr-4 ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}
