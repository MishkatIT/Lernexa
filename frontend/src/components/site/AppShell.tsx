"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/Brand";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { ProfileMenu } from "@/components/site/ProfileMenu";

/** A single destination. `exact` restricts the active state to an exact path
 *  match — use it for section index routes (e.g. /admin) that would otherwise
 *  prefix-match every page in the section. */
export type NavLeaf = { href: string; label: string; exact?: boolean };
/** A labelled, collapsible cluster of destinations — rendered as a disclosure
 *  in the sidebar so a whole area (e.g. content management) is one click to
 *  reveal without leaving the current shell. */
export type NavGroup = { label: string; children: NavLeaf[] };
export type NavEntry = NavLeaf | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup =>
  Array.isArray((e as NavGroup).children);

const makeIsActive =
  (pathname: string) =>
  (href: string, exact = false): boolean =>
    pathname === href ||
    (!exact && href !== "/" && pathname.startsWith(`${href}/`));

const leafClass = (active: boolean) =>
  `rounded-md px-2.5 py-1.5 transition-colors ${
    active
      ? "bg-ink-100 font-medium text-ink-900"
      : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
  }`;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 text-ink-500 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavGroupItem({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = makeIsActive(pathname);
  const hasActiveChild = group.children.some((c) => isActive(c.href, c.exact));
  // null → follow the route (open when a child is active); a boolean is the
  // user's explicit choice for this session and wins.
  const [override, setOverride] = useState<boolean | null>(null);
  const expanded = override ?? hasActiveChild;
  const panelId = `nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setOverride(!expanded)}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
          hasActiveChild && !expanded
            ? "font-medium text-ink-900"
            : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {group.label}
          {hasActiveChild && !expanded ? (
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent-600"
              aria-hidden
            />
          ) : null}
        </span>
        <Chevron open={expanded} />
      </button>

      {expanded ? (
        <div
          id={panelId}
          className="mb-1 ml-[1.4rem] mt-0.5 flex flex-col gap-0.5 border-l border-ink-200 pl-2"
        >
          {group.children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              onClick={onNavigate}
              aria-current={isActive(c.href, c.exact) ? "page" : undefined}
              className={leafClass(isActive(c.href, c.exact))}
            >
              {c.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ShellUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
  roleLabel: string;
  dashboardPath: string;
};

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavEntry[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = makeIsActive(pathname);
  return (
    <nav className="flex flex-col gap-0.5 text-body">
      {items.map((item) =>
        isGroup(item) ? (
          <NavGroupItem
            key={item.label}
            group={item}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ) : (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            className={leafClass(isActive(item.href, item.exact))}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function AppShell({
  nav,
  user,
  children,
}: {
  nav: NavEntry[];
  user: ShellUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    // flex-1 fills <body> (min-h-dvh flex-col); the row stretches its children,
    // so the sidebar is always at least full viewport height.
    <div className="flex flex-1">
      {/* Desktop sidebar — pinned full height, scrolls on its own if the nav
          ever outgrows the viewport. */}
      <aside
        data-surface
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-ink-200 bg-paper-raised px-4 py-6 lg:flex"
      >
        <BrandLockup className="mb-7 px-1" />
        <NavList items={nav} pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — profile + theme on every viewport; brand + menu on mobile. */}
        <header
          data-surface
          className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-ink-200 bg-paper-raised/90 px-5 backdrop-blur-sm sm:px-6 lg:px-10"
        >
          <BrandLockup className="lg:hidden" />
          <p className="hidden text-small font-medium text-ink-500 lg:block">
            {user.roleLabel}
          </p>

          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <div className="hidden lg:block">
              <ProfileMenu
                name={user.name}
                email={user.email}
                avatarUrl={user.avatarUrl}
                dashboardPath={user.dashboardPath}
                showDashboardLink={false}
              />
            </div>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="app-drawer"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-md border border-ink-200 text-ink-700 hover:bg-ink-100 lg:hidden"
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
        </header>

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
            <div className="mt-3 border-t border-ink-200 pt-3">
              <div className="flex items-center gap-2.5 px-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-ink-200 bg-ink-100 text-small font-medium text-ink-700">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary host; no next/image pipeline in this app
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (user.name.trim()[0] ?? "•").toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-ink-900">
                    {user.name}
                  </p>
                  <p className="truncate text-small text-ink-500">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-col text-body">
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2.5 py-1.5 text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="rounded-md px-2.5 py-1.5 text-left text-ink-700 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-60"
                >
                  {loggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex-1 px-5 py-8 sm:px-6 lg:px-10">{children}</div>
      </div>
    </div>
  );
}
