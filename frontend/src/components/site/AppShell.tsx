"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/Brand";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { LogoutButton } from "@/components/LogoutButton";

export type NavItem = { href: string; label: string };

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5 text-body">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              active
                ? "bg-ink-100 font-medium text-ink-900"
                : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  nav,
  user,
  children,
}: {
  nav: NavItem[];
  user: { name: string; roleLabel: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside
        data-surface
        className="hidden w-60 shrink-0 flex-col border-r border-ink-200 bg-paper-raised px-4 py-6 lg:flex"
      >
        <BrandLockup className="mb-7 px-1" />
        <NavList items={nav} pathname={pathname} />
        <div className="mt-auto space-y-3 border-t border-ink-200 pt-4">
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0 text-small">
              <p className="truncate text-ink-900">{user.name}</p>
              <p className="text-ink-500">{user.roleLabel}</p>
            </div>
            <ThemeSwitcher />
          </div>
          <div className="px-1">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div
          data-surface
          className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ink-200 bg-paper-raised/90 px-5 backdrop-blur-sm lg:hidden"
        >
          <BrandLockup />
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <button
              type="button"
              aria-expanded={open}
              aria-controls="app-drawer"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-md border border-ink-200 text-ink-700 hover:bg-ink-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                {open ? (
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open ? (
          <div
            id="app-drawer"
            className="border-b border-ink-200 bg-paper-raised px-5 py-3 lg:hidden"
          >
            <NavList
              items={nav}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
            <div className="mt-3 flex items-center justify-between border-t border-ink-200 pt-3 text-small">
              <span className="text-ink-500">
                {user.name} · {user.roleLabel}
              </span>
              <LogoutButton />
            </div>
          </div>
        ) : null}

        <div className="flex-1 px-5 py-8 sm:px-6 lg:px-10">{children}</div>
      </div>
    </div>
  );
}
