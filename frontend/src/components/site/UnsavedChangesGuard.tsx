"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Site-wide "you have unsaved changes" guard.
 *
 * A form calls `useUnsavedChanges(dirty)` while it holds edits that aren't
 * persisted. While ANY mounted form is dirty, leaving the page is intercepted:
 *
 *   - closing the tab / reload / typing a URL / external link  → native
 *     `beforeunload` prompt (browser-styled, unavoidable wording).
 *   - clicking any in-app `<a>` / `<Link>`                      → a capture-phase
 *     click handler runs a `window.confirm` and cancels the click if declined.
 *     Registered in `useLayoutEffect` so it runs before NavigationProgress's
 *     own click handler — a cancelled navigation never flashes the progress bar.
 *   - browser Back / Forward (SPA popstate)                     → best effort: a
 *     sacrificial history entry is pushed when a form goes dirty, so Back lands
 *     on the same URL and we can prompt before actually leaving.
 *
 * Programmatic `router.push` (a Cancel button, a post-save redirect) is NOT
 * auto-intercepted — the form owns its dirty state, so it calls `confirmLeave()`
 * itself before navigating. See `PostForm` / `CourseForm`.
 */

export const UNSAVED_MESSAGE =
  "You have unsaved changes. Leave this page without saving?";

type GuardApi = {
  register: (id: string, dirty: boolean) => void;
  unregister: (id: string) => void;
  /** True = OK to leave (nothing dirty, or the user confirmed). */
  confirmLeave: () => boolean;
};

const GuardContext = createContext<GuardApi | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  // `dirtyIds` is the source of truth — mutated synchronously in register /
  // unregister, so event handlers can read `.size` without a stale closure.
  // `anyDirty` is the render-visible mirror that drives the effects below.
  const dirtyIds = useRef<Set<string>>(new Set());
  const [anyDirty, setAnyDirty] = useState(false);

  const sync = useCallback(() => {
    const next = dirtyIds.current.size > 0;
    setAnyDirty((prev) => (prev === next ? prev : next));
  }, []);

  const register = useCallback(
    (id: string, dirty: boolean) => {
      if (dirty) dirtyIds.current.add(id);
      else dirtyIds.current.delete(id);
      sync();
    },
    [sync],
  );

  const unregister = useCallback(
    (id: string) => {
      dirtyIds.current.delete(id);
      sync();
    },
    [sync],
  );

  const confirmLeave = useCallback(() => {
    if (dirtyIds.current.size === 0) return true;
    const ok = window.confirm(UNSAVED_MESSAGE);
    if (ok) {
      dirtyIds.current.clear();
      sync();
    }
    return ok;
  }, [sync]);

  // --- native beforeunload: tab close / reload / URL bar / external link ------
  useEffect(() => {
    if (!anyDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // required by some browsers to trigger the prompt
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty]);

  // --- in-app link clicks: run BEFORE NavigationProgress's capture handler ----
  useLayoutEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dirtyIds.current.size === 0) return;
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
        href.startsWith("tel:")
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
      if (
        dest.pathname === window.location.pathname &&
        dest.search === window.location.search
      ) {
        return; // same page — nothing to lose
      }
      if (!window.confirm(UNSAVED_MESSAGE)) {
        e.preventDefault();
        e.stopImmediatePropagation(); // keep the progress bar from starting
      } else {
        dirtyIds.current.clear();
        setAnyDirty(false);
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // --- browser Back / Forward (SPA popstate): best effort --------------------
  useEffect(() => {
    if (!anyDirty) return;
    // Sacrificial entry: Back now lands on this same URL first. Only add one —
    // a repeated edit/save cycle must not pile up dead same-URL entries.
    if (!window.history.state?.__unsavedGuard) {
      window.history.pushState(
        { ...window.history.state, __unsavedGuard: true },
        "",
        window.location.href,
      );
    }
    const onPopState = () => {
      if (dirtyIds.current.size === 0) return;
      if (window.confirm(UNSAVED_MESSAGE)) {
        dirtyIds.current.clear();
        setAnyDirty(false);
        window.history.back(); // past the sacrificial entry to the real target
      } else {
        window.history.pushState(
          { ...window.history.state, __unsavedGuard: true },
          "",
          window.location.href,
        );
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [anyDirty]);

  const api = useMemo<GuardApi>(
    () => ({ register, unregister, confirmLeave }),
    [register, unregister, confirmLeave],
  );

  return <GuardContext.Provider value={api}>{children}</GuardContext.Provider>;
}

/**
 * Declare that this component currently holds unsaved edits. Pass a boolean that
 * flips to `false` once a save succeeds (or the edits are reverted). Returns
 * `confirmLeave()` for the component's own programmatic navigations (Cancel
 * buttons, post-save `router.push`).
 */
export function useUnsavedChanges(dirty: boolean): {
  confirmLeave: () => boolean;
} {
  const ctx = useContext(GuardContext);
  const id = useId();

  useEffect(() => {
    ctx?.register(id, dirty);
    return () => ctx?.unregister(id);
  }, [ctx, id, dirty]);

  return { confirmLeave: ctx?.confirmLeave ?? (() => true) };
}
