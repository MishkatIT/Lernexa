import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition-[background-color,border-color,color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-55";

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-body",
  sm: "h-8 px-3 text-small",
};

const variants: Record<Variant, string> = {
  primary: "bg-accent-600 text-on-accent hover:bg-accent-500",
  secondary:
    "border border-ink-200 bg-paper-raised text-ink-900 hover:border-ink-500 hover:bg-ink-100",
  ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-danger text-on-accent hover:opacity-90",
};

/** Shared so `Button` (a real button) and `ButtonLink` (an anchor) stay identical. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Shown in place of children while `loading`. */
  loadingLabel?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  disabled,
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}

type LinkProps = Omit<React.ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

/** A link styled as a button — for primary navigation actions ("New course"). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: LinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
