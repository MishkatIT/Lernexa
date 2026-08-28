import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { dashboardPathFor } from "@/lib/roles";
import { getMyEnrollments } from "@/lib/learning";
import {
  SAMPLE_CATEGORIES,
  SAMPLE_CONTINUE,
  SAMPLE_STATS,
  SAMPLE_STEPS,
} from "@/lib/samples";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stat } from "@/components/ui/Stat";
import { HeroPanel } from "@/components/home/HeroPanel";
import { ContinueCard } from "@/components/home/ContinueCard";

export default async function HomePage() {
  const user = await getCurrentUser();
  const isStudent = user?.role?.type === "student";
  const enrollments = isStudent ? await getMyEnrollments() : [];

  const resume =
    enrollments.find(
      (e) => e.progress.percent > 0 && e.progress.percent < 100,
    ) ?? enrollments[0];

  const nextLesson = resume
    ? `Lesson ${resume.progress.completed + 1} of ${resume.progress.total}`
    : "";

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
    <>
      {/* ---------- Hero ---------- */}
      <section className="border-b border-ink-200">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-small font-medium uppercase tracking-[0.16em] text-ink-500">
              Learning that moves forward
            </p>
            <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.03em] text-ink-900 sm:text-[3.25rem]">
              Progress, not catalogue.
            </h1>
            <p className="mt-5 max-w-[34rem] text-reading text-ink-700">
              Most platforms open with a wall of courses. Lernexa opens with
              where you are. Every screen answers <em>“where am I?”</em> before{" "}
              <em>“what’s available?”</em>
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={
                  user
                    ? dashboardPathFor(user.role?.type)
                    : "/register"
                }
                className="inline-flex h-11 items-center rounded-md bg-accent-600 px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                {user ? "Go to your dashboard" : "Start learning"}
              </Link>
              <Link
                href="/courses"
                className="inline-flex h-11 items-center rounded-md border border-ink-200 px-5 text-body font-medium text-ink-900 transition-colors hover:border-ink-500 hover:bg-ink-100"
              >
                Browse courses
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            {resume ? (
              <HeroPanel
                topic={resume.course.title}
                lesson={nextLesson}
                completed={resume.progress.completed}
                total={resume.progress.total}
                continueHref={`/learn/${resume.course.id}`}
              />
            ) : (
              <HeroPanel
                topic="Frontend Architecture"
                lesson="Designing scalable component APIs"
                completed={12}
                total={16}
                streakDays={5}
              />
            )}
          </div>
        </Container>
      </section>

      {/* ---------- Continue learning ---------- */}
      <section>
        <Container className="py-16 sm:py-20">
          <SectionHeader
            eyebrow="Keep going"
            title="Continue learning"
            description="Pick up where you left off."
            action={
              isStudent && enrollments.length ? (
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
            {isStudent && enrollments.length ? (
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

      {/* ---------- Explore learning ---------- */}
      <section className="border-t border-ink-200">
        <Container className="py-16 sm:py-20">
          <SectionHeader
            eyebrow="Find a path"
            title="Explore learning"
            description="Structured sequences, not a search box."
          />
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_CATEGORIES.map((c) => (
              <div key={c.name} className="bg-paper-raised p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-h3 text-ink-900">{c.name}</p>
                  <span className="text-small text-ink-500">
                    {c.paths} paths
                  </span>
                </div>
                <p className="mt-1.5 text-body text-ink-700">{c.blurb}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-small text-ink-500">
            Sample categories. The live catalogue is on the{" "}
            <Link href="/courses" className="text-accent-600 hover:underline">
              Courses
            </Link>{" "}
            page.
          </p>
        </Container>
      </section>

      {/* ---------- How Lernexa works ---------- */}
      <section className="border-t border-ink-200">
        <Container className="py-16 sm:py-20">
          <SectionHeader
            eyebrow="The idea"
            title="Learning should move forward."
          />
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {SAMPLE_STEPS.map((s, i) => (
              <li
                key={s.n}
                className={
                  i > 0 ? "sm:border-l sm:border-ink-200 sm:pl-8" : ""
                }
              >
                <p className="font-mono text-small text-accent-600">{s.n}</p>
                <p className="mt-2 text-h3 text-ink-900">{s.title}</p>
                <p className="mt-2 text-body text-ink-700">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------- Progress ---------- */}
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

      {/* ---------- CTA ---------- */}
      {!user ? (
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
      ) : null}
    </>
  );
}
