import Link from "next/link";

/**
 * The mark: three stacked bars, top two filled, bottom one outlined — literally
 * 2-of-3 complete. The logo is a progress indicator.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex flex-col gap-[3px] text-ink-900 ${className}`}
    >
      <span className="block h-[6px] w-6 rounded-[2px] bg-current" />
      <span className="block h-[6px] w-6 rounded-[2px] bg-current" />
      <span className="block h-[6px] w-6 rounded-[2px] border-[1.5px] border-current" />
    </span>
  );
}

export function BrandLockup({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 text-ink-900 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${className}`}
    >
      <BrandMark />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">
        Lernexa
      </span>
    </Link>
  );
}
