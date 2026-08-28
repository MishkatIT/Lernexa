import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/Brand";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

/** Minimal chrome — the learning screen prioritises concentration. */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header
        data-surface
        className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ink-200 bg-paper-raised/90 px-5 backdrop-blur-sm"
      >
        <BrandLockup />
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <Link
            href="/dashboard"
            className="text-small text-ink-700 transition-colors hover:text-ink-900"
          >
            Dashboard
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
