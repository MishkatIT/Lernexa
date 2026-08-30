import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { getStudentDashboard } from "@/lib/learning";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressRing } from "@/components/progress/ProgressRing";
import { ProgressBar } from "@/components/progress/ProgressBar";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("student");
  const { enrollments, attempts, resume } = await getStudentDashboard();

  // Sort for display: in progress first, then not started, then completed.
  const rank = (p: number) => (p > 0 && p < 100 ? 0 : p === 0 ? 1 : 2);
  const sorted = [...enrollments].sort(
    (a, b) => rank(a.progress.percent) - rank(b.progress.percent),
  );

  const inProgress = enrollments.filter(
    (e) => e.progress.percent > 0 && e.progress.percent < 100,
  ).length;
  const completed = enrollments.filter((e) => e.progress.percent === 100).length;
  const lessonsDone = enrollments.reduce((s, e) => s + e.progress.completed, 0);
  const avgScore =
    attempts.length > 0
      ? Math.round(
          (attempts.reduce(
            (s, a) => s + (a.totalQuestions ? a.score / a.totalQuestions : 0),
            0,
          ) /
            attempts.length) *
            100,
        )
      : null;

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <p className="text-small font-medium uppercase tracking-[0.14em] text-ink-500">
        Your dashboard
      </p>
      <div className="mt-1.5 flex items-center gap-3">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary host; no next/image pipeline in this app
          <img
            src={user.avatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-ink-200 object-cover"
          />
        ) : null}
        <h1 className="text-display text-ink-900">
          {user.fullName ?? user.username}
        </h1>
      </div>

      {enrollments.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Your learning space is ready"
            description="You haven't enrolled in anything yet. Choose something to start building your progress."
            action={{ label: "Explore courses", href: "/courses" }}
          />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-ink-200 py-6 sm:grid-cols-4">
            <Stat label="In progress" value={inProgress} />
            <Stat label="Completed" value={completed} />
            <Stat label="Lessons done" value={lessonsDone} />
            <Stat
              label="Avg quiz score"
              value={avgScore === null ? "—" : `${avgScore}%`}
            />
          </div>

          {resume ? (
            <Card className="mt-8 flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
              <ProgressRing
                completed={resume.progress.completed}
                total={resume.progress.total}
                size={56}
              />
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium uppercase tracking-[0.12em] text-accent-600">
                  {resume.progress.percent === 0 ? "Start" : "Continue"}
                </p>
                <p className="mt-1 truncate text-h2 text-ink-900">
                  {resume.course.title}
                </p>
                <p className="mt-0.5 truncate text-small text-ink-500">
                  {resume.progress.total === 0
                    ? "This course has no lessons yet"
                    : resume.nextLessonTitle
                      ? `Up next — ${resume.nextLessonTitle}`
                      : `${resume.progress.completed} of ${resume.progress.total} lessons`}
                </p>
              </div>
              {resume.progress.total > 0 ? (
                <ButtonLink
                  href={`/learn/${resume.course.id}`}
                  className="shrink-0"
                >
                  {resume.progress.percent === 0 ? "Start" : "Continue"}
                </ButtonLink>
              ) : null}
            </Card>
          ) : null}

          <section className="mt-12">
            <SectionHeader
              title="My courses"
              action={
                <Link
                  href="/courses"
                  className="text-small text-accent-600 hover:underline"
                >
                  Browse all →
                </Link>
              }
            />
            <ul className="mt-5 flex flex-col gap-2">
              {sorted.map((e) => {
                const done = e.progress.percent === 100;
                return (
                  <li key={e.course.id}>
                    <Card
                      as={Link}
                      href={`/learn/${e.course.id}`}
                      interactive
                      className="block p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-body font-medium text-ink-900">
                          {e.course.title}
                        </span>
                        {done ? (
                          <Badge tone="success">✓ Done</Badge>
                        ) : (
                          <span className="shrink-0 font-mono text-small text-ink-500">
                            {e.progress.completed}/{e.progress.total}
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5">
                        <ProgressBar
                          completed={e.progress.completed}
                          total={e.progress.total}
                          showLabel={false}
                          size="sm"
                        />
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>

          {attempts.length > 0 ? (
            <section className="mt-12">
              <SectionHeader
                title="Recent quiz scores"
                action={
                  <Link
                    href="/results"
                    className="text-small text-accent-600 hover:underline"
                  >
                    All results &amp; review →
                  </Link>
                }
              />
              <ul className="mt-5 divide-y divide-ink-200 overflow-hidden rounded-lg border border-ink-200">
                {attempts.slice(0, 5).map((a, i) => {
                  const pct = a.totalQuestions
                    ? Math.round((a.score / a.totalQuestions) * 100)
                    : 0;
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 bg-paper-raised px-4 py-3 text-body"
                    >
                      <span className="min-w-0 truncate text-ink-900">
                        {a.quiz?.title ?? "Quiz"}
                        {a.quiz?.course ? (
                          <span className="ml-2 text-small text-ink-500">
                            {a.quiz.course.title}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono text-small text-ink-500">
                        {a.score}/{a.totalQuestions} · {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Container>
  );
}
