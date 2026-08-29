import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { getMyAttempts, type MyAttempt } from "@/lib/quiz";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Quiz results" };

function pct(a: MyAttempt) {
  return a.totalQuestions ? Math.round((a.score / a.totalQuestions) * 100) : 0;
}

export default async function ResultsPage() {
  await requireRole("student");
  const attempts = await getMyAttempts();

  // Group by course so a student with many attempts can scan by subject.
  const byCourse = new Map<
    string,
    { courseTitle: string; courseId: string | null; attempts: MyAttempt[] }
  >();
  for (const a of attempts) {
    const key = a.quiz?.course?.id ?? a.quiz?.id ?? "unknown";
    const entry = byCourse.get(key) ?? {
      courseTitle: a.quiz?.course?.title ?? a.quiz?.title ?? "Quiz",
      courseId: a.quiz?.course?.id ?? null,
      attempts: [],
    };
    entry.attempts.push(a);
    byCourse.set(key, entry);
  }

  return (
    <Container size="content" className="py-10 sm:py-14">
      <SectionHeader
        as="h1"
        eyebrow="Your learning"
        title="Quiz results"
        description="Every quiz you've submitted, newest first. Each attempt keeps a frozen copy of the questions as they were when you took it."
      />

      {attempts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No quiz attempts yet"
            description="Once you submit a quiz in one of your courses, your score and a full review land here."
            action={{ label: "Go to your courses", href: "/dashboard" }}
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {[...byCourse.values()].map((group) => (
            <section key={group.courseTitle}>
              <h2 className="text-h3 text-ink-900">
                {group.courseId ? (
                  <Link
                    href={`/learn/${group.courseId}`}
                    className="hover:text-accent-600 hover:underline"
                  >
                    {group.courseTitle}
                  </Link>
                ) : (
                  group.courseTitle
                )}
              </h2>

              <ul className="mt-4 flex flex-col gap-2">
                {group.attempts.map((a) => (
                  <li key={a.id}>
                    <details className="group rounded-lg border border-ink-200 bg-paper-raised">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="text-body text-ink-900">
                            {a.quiz?.title ?? "Quiz"}
                          </span>
                          <span className="ml-2 font-mono text-small text-ink-500">
                            {new Date(a.submittedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span
                            className={`font-mono text-small ${
                              pct(a) >= 100
                                ? "text-success"
                                : pct(a) >= 50
                                  ? "text-ink-900"
                                  : "text-danger"
                            }`}
                          >
                            {a.score}/{a.totalQuestions} · {pct(a)}%
                          </span>
                          {a.answers.length > 0 ? (
                            <span className="text-small text-accent-600 group-open:hidden">
                              Review →
                            </span>
                          ) : null}
                        </span>
                      </summary>

                      {a.answers.length > 0 ? (
                        <ol className="flex flex-col gap-3 border-t border-ink-200 px-4 py-4">
                          {a.answers.map((row, i) => (
                            <li key={i} className="text-small">
                              <p className="font-medium text-ink-900">
                                {i + 1}. {row.prompt}
                              </p>
                              <p
                                className={`mt-1 ${
                                  row.correct ? "text-success" : "text-danger"
                                }`}
                              >
                                {row.correct ? "✓ " : "✗ "}
                                Your answer:{" "}
                                {row.selectedOptionText ?? "— (left blank)"}
                              </p>
                              {!row.correct && row.correctOptionText ? (
                                <p className="mt-0.5 text-ink-500">
                                  Correct answer: {row.correctOptionText}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="border-t border-ink-200 px-4 py-3 text-small text-ink-500">
                          This attempt predates per-question review — only the
                          score was stored.
                        </p>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}
