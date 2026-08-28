"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/components/Brand";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

type NavUser = { dashboardPath: string } | null;

const LINKS = [
  { href: "/courses", label: "Courses" },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      data-surface
      className="sticky top-0 z-40 border-b border-ink-200 bg-paper-raised/85 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-14 w-full max-w-[75rem] items-center justify-between px-5 sm:px-6">
        <BrandLockup />

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-body transition-colors ${
                isActive(l.href)
                  ? "text-ink-900"
                  : "text-ink-700 hover:text-ink-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeSwitcher />
          {user ? (
            <Link
              href={user.dashboardPath}
              className="inline-flex h-9 items-center rounded-md bg-accent-600 px-4 text-small font-medium text-on-accent transition-colors hover:bg-accent-500"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-md px-3 text-body text-ink-700 transition-colors hover:text-ink-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-md bg-accent-600 px-4 text-small font-medium text-on-accent transition-colors hover:bg-accent-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-md border border-ink-200 text-ink-700 transition-colors hover:bg-ink-100 md:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-ink-200 bg-paper-raised px-5 pb-6 pt-2 md:hidden"
        >
          <nav className="flex flex-col">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-2 py-2.5 text-body text-ink-700 hover:bg-ink-100 hover:text-ink-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="mt-3 flex items-center justify-between border-t border-ink-200 pt-4">
            <span className="text-small text-ink-500">Theme</span>
            <ThemeSwitcher />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {user ? (
              <Link
                href={user.dashboardPath}
                className="inline-flex h-10 items-center justify-center rounded-md bg-accent-600 px-4 text-body font-medium text-on-accent"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-ink-200 px-4 text-body font-medium text-ink-900"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-accent-600 px-4 text-body font-medium text-on-accent"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
