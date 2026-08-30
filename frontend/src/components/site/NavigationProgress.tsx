"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A hairline progress bar pinned to the top of the viewport. It appears the
 * instant a client-side navigation starts and completes when the new route
 * commits.
 *
 * Why it exists: a dynamic route does a server round-trip on click. Even with a
 * `loading.tsx` there's a beat before the skeleton paints, and with prefetch
 * off (always, in `next dev`) that beat is longer — long enough to read as a
 * dead click, so people click again. This is the always-on, global "working on
 * it" signal that stops the double-click.
 *
 * Start is detected by capturing link clicks before React sees them, plus a
 * `lernexa:navigate` window event that programmatic `router.push` callers can
 * dispatch. Completion is the committed pathname / search params changing, with
 * an 8s failsafe so the bar can never get stuck on.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);

  const running = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
  }, []);

  const done = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    clear();
    setValue(1);
    timers.current.push(
      setTimeout(() => setVisible(false), 200),
      setTimeout(() => setValue(0), 450),
    );
  }, [clear]);

  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    clear();
    setValue(0.08);
    // Hold the reveal for a moment so a prefetched, near-instant navigation
    // never flashes the bar — mirrors the loading.js "show only if it's slow"
    // guidance.
    timers.current.push(
      setTimeout(() => {
        if (running.current) setVisible(true);
      }, 120),
    );
    trickle.current = setInterval(() => {
      setValue((v) => (v >= 0.92 ? v : v + (0.92 - v) * 0.1));
    }, 220);
    timers.current.push(setTimeout(done, 8000));
  }, [clear, done]);

  // Completion — the committed URL changed.
  useEffect(() => {
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Start — capture internal link clicks + the explicit event hook.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as Element | null)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (
        !anchor ||
        !href ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        (anchor.getAttribute("rel") ?? "").includes("external")
      ) {
        return;
      }
      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;
      // Same page (or hash-only) — no navigation to wait on.
      if (
        dest.pathname === window.location.pathname &&
        dest.search === window.location.search
      ) {
        return;
      }
      start();
    }

    const onManual = () => start();

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("lernexa:navigate", onManual);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("lernexa:navigate", onManual);
      clear();
    };
  }, [start, clear]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-accent-600"
        style={{
          width: `${value * 100}%`,
          transition: "width 200ms ease",
          boxShadow: "0 0 8px var(--color-accent-500)",
        }}
      />
    </div>
  );
}
