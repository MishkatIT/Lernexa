"use client";

import { useEffect, useState } from "react";
import { CourseCard } from "@/components/ui/CourseCard";
import type { CourseLite } from "@/lib/courses";

type Progress = { completed: number; total: number; percent: number };

type HomePayload = {
  data: {
    isStudent: boolean;
    enrollments: { course: { id: string }; progress: Progress }[];
  } | null;
};

/**
 * The catalogue grid.
 *
 * Course data is server-rendered — it's the shared, cached catalogue
 * (`listCatalogue`, `revalidate: 180`, tag `courses`), identical for every
 * visitor. The per-student "your progress" overlay on a card is filled in here
 * after hydration via `/api/me/home`, the same client-island pattern the
 * homepage uses. That keeps the session read off the `/courses` render path, so
 * the page's RSC response only ever awaits the cached catalogue fetch instead
 * of blocking on `/api/users/me` + `/api/enrollments/me` per request.
 *
 * Anonymous visitors (no `lernexa:authed` hint) do no fetch and see the plain
 * catalogue with no flash.
 */
export function CatalogueGrid({ courses }: { courses: CourseLite[] }) {
  const [progressByCourse, setProgressByCourse] = useState<
    Map<string, Progress>
  >(() => new Map());

  useEffect(() => {
    let signedIn = false;
    try {
      signedIn = localStorage.getItem("lernexa:authed") === "1";
    } catch {
      /* private mode / disabled storage — treat as anonymous */
    }
    if (!signedIn) return;

    let alive = true;
    const load = () =>
      fetch("/api/me/home", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { data: null }))
        .then((d: HomePayload) => {
          if (!alive) return;
          const enrollments = d.data?.isStudent ? d.data.enrollments : [];
          setProgressByCourse(
            new Map(enrollments.map((e) => [e.course.id, e.progress])),
          );
        })
        .catch(() => {
          /* leave the plain catalogue in place */
        });

    load();
    // Progress moved while they were away (finished a lesson in another tab).
    const onNav = () => load();
    window.addEventListener("lernexa:navigate", onNav);
    return () => {
      alive = false;
      window.removeEventListener("lernexa:navigate", onNav);
    };
  }, []);

  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <CourseCard
          key={c.documentId}
          href={`/courses/${c.slug ?? c.documentId}`}
          title={c.title}
          instructor={c.instructor?.fullName}
          description={c.description}
          lessons={c.lessons.length}
          coverImageUrl={c.coverImageUrl}
          progress={progressByCourse.get(c.documentId) ?? null}
        />
      ))}
    </div>
  );
}
