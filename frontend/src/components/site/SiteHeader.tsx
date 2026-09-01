"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLockup } from "@/components/Brand";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { ProfileMenu } from "@/components/site/ProfileMenu";

type NavUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
  dashboardPath: string;
};

const LINKS = [
  { href: "/courses", label: "Courses" },
  { href: "/blog", label: "Blog" },
];

const AUTH_HINT = "lernexa:authed";

/**
 * The session read used to happen in the public layout, which forced every page
 * under it to render dynamically. It now happens here on the client
 * (`GET /api/auth/me`) so the layout — and pages that don't otherwise touch the
 * cookie, like a blog article — can be static / ISR. `undefined` = still
 * loading; `null` = anonymous. A localStorage hint from the last login lets a
 * returning signed-in user see the avatar slot immediately instead of a
 * log-in/sign-up flash.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [user, setUser] = useState<NavUser | null | undefined>(undefined);
  const [optimisticAuthed, setOptimisticAuthed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const close = () => setOpen(false);

  useEffect(() => {
    // Mount-time read of an external store (localStorage) — it isn't available
    // during render, and the first client paint must match the server's
    // (no-hint) output, so this necessarily lands one tick later.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptimisticAuthed(localStorage.getItem(AUTH_HINT) === "1");
    } catch {
      /* private mode / disabled storage — no hint, that's fine */
    }

    let alive = true;
    const load = () =>
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((d: { user: NavUser | null }) => {
          if (!alive) return;
          setUser(d.user);
          try {
            localStorage.setItem(AUTH_HINT, d.user ? "1" : "0");
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          if (alive) setUser(null);
        });

    load();
    const onNav = () => load();
    window.addEventListener("lernexa:navigate", onNav);
    return () => {
      alive = false;
      window.removeEventListener("lernexa:navigate", onNav);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      localStorage.setItem(AUTH_HINT, "0");
    } catch {
      /* ignore */
    }
    setUser(null);
    close();
    window.dispatchEvent(new Event("lernexa:navigate"));
    router.push("/");
    router.refresh();
  }

  const showAuthPlaceholder = user === undefined && optimisticAuthed;

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
            <ProfileMenu
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarUrl}
              dashboardPath={user.dashboardPath}
            />
          ) : showAuthPlaceholder ? (
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-paper-raised"
            >
              <span className="h-4 w-4 animate-pulse rounded-full bg-ink-200" />
            </span>
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
                onClick={close}
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

          {user ? (
            <div className="mt-4 border-t border-ink-200 pt-4">
              <div className="flex items-center gap-2.5 px-2">
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
              <div className="mt-2 flex flex-col">
                <Link
                  href={user.dashboardPath}
                  onClick={close}
                  className="rounded-md px-2 py-2.5 text-body text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  onClick={close}
                  className="rounded-md px-2 py-2.5 text-body text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="rounded-md px-2 py-2.5 text-left text-body text-ink-700 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-60"
                >
                  {loggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={close}
                className="inline-flex h-10 items-center justify-center rounded-md border border-ink-200 px-4 text-body font-medium text-ink-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={close}
                className="inline-flex h-10 items-center justify-center rounded-md bg-accent-600 px-4 text-body font-medium text-on-accent"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
