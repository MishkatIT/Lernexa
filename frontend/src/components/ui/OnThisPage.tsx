"use client";

import { useEffect, useRef, useState } from "react";

export type PageSection = { id: string; label: string };

/**
 * Sticky "On this page" rail for long, multi-section pages (course editing,
 * and anything else with several stacked `<section>`s that needs scrolling).
 *
 * - Renders nothing below `xl` — narrow layouts are short enough to scroll and a
 *   floating rail would crowd them. Place it in an `xl:` two-column grid so it
 *   only takes space where it shows.
 * - Each `id` must match the `id` on a real section element. Give those sections
 *   `scroll-mt-24` so smooth-scroll targets clear the sticky app header.
 */
export function OnThisPage({
  sections,
  className = "",
}: {
  sections: PageSection[];
  className?: string;
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  // After a click we scroll smoothly; ignore scroll tracking until it settles so
  // the rail doesn't flicker through the sections it passes over.
  const settling = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = sections.map((s) => s.id).join("|");

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    // The header line: sticky app header (~56px) plus breathing room — kept in
    // step with the sections' `scroll-mt-24` (96px).
    const LINE = 96;

    const pickActive = () => {
      if (settling.current) return;

      // At the bottom of the page the last section is "current" even when it's
      // too short to ever reach the header line.
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 4
      ) {
        setActiveId(ids[ids.length - 1]);
        return;
      }

      let current = ids[0];
      for (const el of els) {
        if (el.getBoundingClientRect().top - LINE <= 0) current = el.id;
        else break;
      }
      setActiveId(current);
    };

    pickActive();
    window.addEventListener("scroll", pickActive, { passive: true });
    window.addEventListener("resize", pickActive);
    return () => {
      window.removeEventListener("scroll", pickActive);
      window.removeEventListener("resize", pickActive);
    };
  }, [key]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      settling.current = true;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        settling.current = false;
      }, 600);
    }
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActiveId(id);
    history.replaceState(null, "", `#${id}`);
  }

  if (sections.length < 2) return null;

  return (
    <nav aria-label="On this page" className={`hidden xl:block ${className}`}>
      <div className="sticky top-24">
        <p className="mb-3 text-small font-medium uppercase tracking-[0.14em] text-ink-500">
          On this page
        </p>
        <ul className="flex flex-col border-l border-ink-200 text-small">
          {sections.map((s) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => handleClick(e, s.id)}
                  aria-current={active ? "location" : undefined}
                  className={`-ml-px block border-l-2 py-1.5 pl-3 transition-colors ${
                    active
                      ? "border-accent-600 font-medium text-ink-900"
                      : "border-transparent text-ink-500 hover:border-ink-200 hover:text-ink-900"
                  }`}
                >
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
