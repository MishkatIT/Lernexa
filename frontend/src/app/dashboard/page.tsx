import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { getMyEnrollments } from "@/lib/learning";
import { ProgressRing } from "@/components/progress/ProgressRing";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("student");
  const enrollments = await getMyEnrollments();

  // Resume: the first in-progress course, else the most recent enrolment.
  const resume =
    enrollments.find((e) => e.progress.percent > 0 && e.progress.percent < 100) ??
    enrollments[0];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {user.fullName ?? user.username}
        </h1>
        <LogoutButton />
      </div>

      {enrollments.length === 0 ? (
        <div className="mt-8 rounded-sm border border-ink-200 bg-paper-raised p-6">
          <p className="text-[15px] text-ink-700">
            You haven&apos;t enrolled in anything yet.
          </p>
          <Link
            href="/courses"
            className="mt-3 inline-block rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
          >
            Browse courses
          </Link>
        </div>
      ) : (
        <>
          {resume ? (
            <section className="mt-8 flex items-center gap-5 rounded-sm border border-ink-200 bg-paper-raised p-6">
              <ProgressRing
                completed={resume.progress.completed}
                total={resume.progress.total}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] uppercase tracking-wide text-ink-500">
                  {resume.progress.percent === 0 ? "Start" : "Continue"}
                </p>
                <p className="truncate text-[17px] font-semibold text-ink-900">
                  {resume.course.title}
                </p>
                <p className="text-[13px] text-ink-500">
                  {resume.progress.total === 0
                    ? "This course has no lessons yet"
                    : `${resume.progress.completed} of ${resume.progress.total} lessons`}
                </p>
              </div>
              {resume.progress.total > 0 ? (
                <Link
                  href={`/learn/${resume.course.id}`}
                  className="shrink-0 rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
                >
                  {resume.progress.percent === 0 ? "Start" : "Continue"}
                </Link>
              ) : null}
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="text-[16px] font-semibold text-ink-900">My courses</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {enrollments.map((e) => (
                <li
                  key={e.course.id}
                  className="rounded-sm border border-ink-200 bg-paper-raised px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/learn/${e.course.id}`}
                      className="text-[15px] font-medium text-ink-900 hover:underline"
                    >
                      {e.course.title}
                    </Link>
                    <span className="font-mono text-[13px] text-ink-500">
                      {e.progress.completed}/{e.progress.total}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      completed={e.progress.completed}
                      total={e.progress.total}
                      showLabel={false}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
