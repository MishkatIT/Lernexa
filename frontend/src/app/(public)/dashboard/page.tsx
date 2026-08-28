import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { getMyEnrollments } from "@/lib/learning";
import { getMyAttempts } from "@/lib/quiz";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/progress/ProgressRing";
import { ProgressBar } from "@/components/progress/ProgressBar";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("student");
  const [enrollments, attempts] = await Promise.all([
    getMyEnrollments(),
    getMyAttempts(),
  ]);

  const resume =
    enrollments.find(
      (e) => e.progress.percent > 0 && e.progress.percent < 100,
    ) ?? enrollments[0];

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <p className="text-small font-medium uppercase tracking-[0.14em] text-ink-500">
        Your dashboard
      </p>
      <h1 className="mt-1.5 text-display text-ink-900">
        {user.fullName ?? user.username}
      </h1>

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
                <p className="mt-0.5 text-small text-ink-500">
                  {resume.progress.total === 0
                    ? "This course has no lessons yet"
                    : `${resume.progress.completed} of ${resume.progress.total} lessons`}
                </p>
              </div>
              {resume.progress.total > 0 ? (
                <Link
                  href={`/learn/${resume.course.id}`}
                  className="inline-flex h-10 shrink-0 items-center rounded-md bg-accent-600 px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-500"
                >
                  {resume.progress.percent === 0 ? "Start" : "Continue"}
                </Link>
              ) : null}
            </Card>
          ) : null}

          <section className="mt-12">
            <SectionHeader title="My courses" />
            <ul className="mt-5 flex flex-col gap-2">
              {enrollments.map((e) => (
                <li key={e.course.id}>
                  <Card as={Link} href={`/learn/${e.course.id}`} interactive className="block p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-body font-medium text-ink-900">
                        {e.course.title}
                      </span>
                      <span className="font-mono text-small text-ink-500">
                        {e.progress.completed}/{e.progress.total}
                      </span>
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
              ))}
            </ul>
          </section>

          {attempts.length > 0 ? (
            <section className="mt-12">
              <SectionHeader title="Recent quiz scores" />
              <ul className="mt-5 divide-y divide-ink-200 rounded-lg border border-ink-200">
                {attempts.slice(0, 5).map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between bg-paper-raised px-4 py-3 text-body first:rounded-t-lg last:rounded-b-lg"
                  >
                    <span className="text-ink-900">
                      {a.quiz?.title ?? "Quiz"}
                      {a.quiz?.course ? (
                        <span className="ml-2 text-small text-ink-500">
                          {a.quiz.course.title}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-small text-ink-500">
                      {a.score}/{a.totalQuestions}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Container>
  );
}
