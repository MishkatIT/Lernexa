"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { SAMPLE_CONTINUE, SAMPLE_STATS } from "@/lib/samples";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stat } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { HeroPanel } from "@/components/home/HeroPanel";
import { ContinueCard } from "@/components/home/ContinueCard";

/**
 * Client-side personalisation for the homepage.
 *
 * The page itself is now a static server component — no session read, no
 * per-request work — so it prerenders once and serves from the edge. The
 * signed-in slices (resume panel, continue cards, real stat grid, and hiding
 * the signed-out CTA) are swapped in here after hydration, and only for a
 * visitor the `lernexa:authed` hint marks as signed in. Anonymous visitors
 * keep the prerendered sample content with no fetch and no flash.
 */

type Progress = { completed: number; total: number; percent: number };
type Enrollment = {
  course: { id: string; title: string; slug: string | null };
  progress: Progress;
};
type HomeData = {
  dashboardPath: string;
  isStudent: boolean;
  enrollments: Enrollment[];
};

const HomeCtx = createContext<{
  data: HomeData | null;
  /** The `lernexa:authed` hint said this visitor is signed in (set at mount,
   *  before the fetch resolves). Lets signed-in-only chrome hide immediately. */
  hintSignedIn: boolean;
}>({ data: null, hintSignedIn: false });

export function HomePersonalizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [data, setData] = useState<HomeData | null>(null);
  const [hintSignedIn, setHintSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;

    let signedInHint = false;
    try {
      signedInHint = localStorage.getItem("lernexa:authed") === "1";
    } catch {
      /* private mode / disabled storage — treat as anonymous */
    }

    // Anonymous visitors: the static render already has everything — no fetch.
    if (!signedInHint) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time sync from an external store, mirrors SiteHeader
    setHintSignedIn(true);
    fetch("/api/me/home", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((d: { data: HomeData | null }) => {
        if (alive) setData(d.data);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  return (
    <HomeCtx.Provider value={{ data, hintSignedIn }}>
      {children}
    </HomeCtx.Provider>
  );
}

const HERO_BTN =
  "inline-flex h-11 items-center rounded-md bg-accent-600 px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** Hero primary action. Anonymous / still-loading → "Start learning" → /register
 *  (the prerendered default). Signed in → straight to the role's dashboard. */
export function HeroCtaButton() {
  const { data } = useContext(HomeCtx);
  if (data) {
    return (
      <Link href={data.dashboardPath} className={HERO_BTN}>
        Go to your dashboard
      </Link>
    );
  }
  return (
    <Link href="/register" className={HERO_BTN}>
      Start learning
    </Link>
  );
}

/** Hero product visual. Sample slice by default; a signed-in student with an
 *  in-progress (or any) enrolment gets their real resume card. */
export function HeroVisual() {
  const { data } = useContext(HomeCtx);
  const enrollments = data?.isStudent ? data.enrollments : [];
  const resume =
    enrollments.find((e) => e.progress.percent > 0 && e.progress.percent < 100) ??
    enrollments[0];

  if (resume) {
    return (
      <HeroPanel
        topic={resume.course.title}
        lesson={`Lesson ${resume.progress.completed + 1} of ${resume.progress.total}`}
        completed={resume.progress.completed}
        total={resume.progress.total}
        continueHref={`/learn/${resume.course.id}`}
      />
    );
  }

  return (
    <HeroPanel
      topic="Frontend Architecture"
      lesson="Designing scalable component APIs"
      completed={12}
      total={16}
      streakDays={5}
    />
  );
}

/** "Continue learning" section — sample cards for everyone; a signed-in student
 *  with enrolments sees their own two most relevant courses. Header text and
 *  layout are identical in both states, so the swap never shifts the page. */
export function ContinueSection() {
  const { data } = useContext(HomeCtx);
  const enrollments = data?.isStudent ? data.enrollments : [];
  const show = enrollments.length > 0;

  return (
    <section>
      <Container className="py-16 sm:py-20">
        <SectionHeader
          eyebrow="Keep going"
          title="Continue learning"
          description="Pick up where you left off."
          action={
            show ? (
              <Link
                href="/dashboard"
                className="text-small font-medium text-accent-600 hover:text-accent-500"
              >
                All courses →
              </Link>
            ) : undefined
          }
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {show ? (
            enrollments.slice(0, 2).map((e) => (
              <ContinueCard
                key={e.course.id}
                topic={e.course.title}
                lesson={
                  e.progress.total === 0
                    ? "No lessons yet"
                    : `Lesson ${Math.min(
                        e.progress.completed + 1,
                        e.progress.total,
                      )} of ${e.progress.total}`
                }
                completed={e.progress.completed}
                total={e.progress.total}
                meta={`${e.progress.percent}% complete`}
                href={`/learn/${e.course.id}`}
              />
            ))
          ) : (
            <>
              {SAMPLE_CONTINUE.map((s) => (
                <ContinueCard
                  key={s.topic}
                  topic={s.topic}
                  lesson={s.lesson}
                  completed={s.completed}
                  total={s.total}
                  meta={`Last activity ${s.lastActivity}`}
                />
              ))}
              <p className="text-small text-ink-500 sm:col-span-2">
                A preview — sign in to see your own progress here.
              </p>
            </>
          )}
        </div>
      </Container>
    </section>
  );
}

/** "Track what matters" — sample stat grid by default; a signed-in student gets
 *  their real totals (a student with zero enrolments still gets the real, all-
 *  zero grid, exactly as the old server render did). */
export function ProgressSection() {
  const { data } = useContext(HomeCtx);
  const isStudent = Boolean(data?.isStudent);
  const enrollments = data?.isStudent ? data.enrollments : [];

  const realStats = isStudent
    ? [
        {
          label: "Lessons completed",
          value: String(
            enrollments.reduce((s, e) => s + e.progress.completed, 0),
          ),
        },
        { label: "Courses in progress", value: String(enrollments.length) },
        {
          label: "Average progress",
          value: `${
            enrollments.length
              ? Math.round(
                  enrollments.reduce((s, e) => s + e.progress.percent, 0) /
                    enrollments.length,
                )
              : 0
          }%`,
        },
        {
          label: "Lessons remaining",
          value: String(
            enrollments.reduce(
              (s, e) => s + (e.progress.total - e.progress.completed),
              0,
            ),
          ),
        },
      ]
    : null;

  return (
    <section className="border-t border-ink-200">
      <Container className="py-16 sm:py-20">
        <SectionHeader
          eyebrow="What we measure"
          title="Track what matters."
          description={
            realStats
              ? "Your progress so far."
              : "Progress is the product — here’s the shape of it."
          }
        />
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {(realStats ?? SAMPLE_STATS).map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </Container>
    </section>
  );
}

/** The "create an account" closer — shown only once we're sure the visitor is
 *  anonymous, so a signed-in user never sees it flash in. */
export function SignedOutCta() {
  const { data, hintSignedIn } = useContext(HomeCtx);
  if (data || hintSignedIn) return null;

  return (
    <section className="border-t border-ink-200">
      <Container className="py-16 text-center sm:py-20">
        <Card className="mx-auto max-w-2xl px-6 py-10">
          <h2 className="text-h1 text-ink-900">Ready to make progress?</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-ink-700">
            Create an account and your dashboard will resume you at the next
            lesson, every time.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex h-11 items-center rounded-md bg-accent-600 px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-500"
          >
            Create an account
          </Link>
        </Card>
      </Container>
    </section>
  );
}
