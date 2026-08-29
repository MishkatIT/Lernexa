import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getQuizToTake, getMyAttempts } from "@/lib/quiz";
import { QuizTaker } from "@/components/learn/QuizTaker";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  await requireRole("student");
  const { courseId, quizId } = await params;

  const quiz = await getQuizToTake(quizId);
  if (!quiz) notFound(); // not enrolled, or no such quiz

  const attempts = (await getMyAttempts()).filter((a) => a.quiz?.id === quizId);

  return (
    <div>
      <QuizTaker courseId={courseId} quiz={quiz} />
      {attempts.length > 0 ? (
        <div className="mx-auto max-w-[68ch] px-6 pb-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-500">
              Past attempts
            </h2>
            <Link
              href="/results"
              className="text-[13px] text-accent-600 hover:underline"
            >
              Full review →
            </Link>
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-[14px]">
            {attempts.map((a) => (
              <li
                key={a.id}
                className="flex justify-between rounded-sm border border-ink-200 px-3 py-2"
              >
                <span className="font-mono text-ink-500">
                  {new Date(a.submittedAt).toLocaleString()}
                </span>
                <span className="font-mono text-ink-900">
                  {a.score}/{a.totalQuestions}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
