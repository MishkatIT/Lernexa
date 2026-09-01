"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "•";
}

export function ProfileMenu({
  name,
  email,
  avatarUrl,
  dashboardPath,
  showDashboardLink = true,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  dashboardPath: string;
  /** Hidden inside the manage/admin shell, where you're already "home". */
  showDashboardLink?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      localStorage.setItem("lernexa:authed", "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("lernexa:navigate"));
    router.push("/");
    router.refresh();
  }

  const item =
    "block w-full rounded-sm px-2.5 py-1.5 text-left text-small text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-ink-200 bg-paper-raised text-small font-medium text-ink-700 transition-colors hover:border-ink-500 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary host; no next/image pipeline in this app
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-md border border-ink-200 bg-paper-raised p-1 shadow-[var(--shadow-overlay)]"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-ink-200 bg-ink-100 text-small font-medium text-ink-700">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary host; no next/image pipeline in this app
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(name)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-body font-medium text-ink-900">
                {name}
              </p>
              <p className="truncate text-small text-ink-500">{email}</p>
            </div>
          </div>
          <div className="my-1 border-t border-ink-200" />
          {showDashboardLink ? (
            <Link
              role="menuitem"
              href={dashboardPath}
              onClick={() => setOpen(false)}
              className={item}
            >
              Dashboard
            </Link>
          ) : null}
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className={item}
          >
            Settings
          </Link>
          <div className="my-1 border-t border-ink-200" />
          <button
            role="menuitem"
            onClick={logout}
            disabled={loggingOut}
            className={`${item} disabled:opacity-60`}
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
