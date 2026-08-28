import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformStats } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const stats = await getPlatformStats();

  const strip: { label: string; value: string | number }[] = [
    { label: "Users", value: stats.users.total },
    { label: "Instructors", value: stats.users.instructors },
    { label: "Students", value: stats.users.students },
    { label: "Blocked", value: stats.users.blocked },
    { label: "Active / 7d", value: stats.users.activeLast7Days },
    { label: "Courses", value: stats.content.courses },
    { label: "Enrollments", value: stats.content.enrollments },
    { label: "Quiz attempts", value: stats.content.quizAttempts },
    { label: "Avg completion", value: `${stats.content.overallCompletionPercent}%` },
  ];

  const attention: { text: string; count: number; href: string }[] = [
    {
      text: "quiz(zes) with no correct answer marked",
      count: stats.attention.quizzesWithoutCorrectAnswer,
      href: "/manage/courses",
    },
    {
      text: "course(s) with no lessons",
      count: stats.attention.coursesWithoutLessons,
      href: "/manage/courses",
    },
    {
      text: "blocked user(s)",
      count: stats.attention.blockedUsers,
      href: "/admin/users?status=blocked",
    },
  ].filter((row) => row.count > 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        What needs attention
      </h1>

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-y border-ink-200 py-4">
        {strip.map((s) => (
          <div key={s.label}>
            <p className="font-mono text-[20px] text-ink-900">{s.value}</p>
            <p className="text-[12px] uppercase tracking-wide text-ink-500">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-ink-900">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-500">
            Nothing flagged. Every quiz has a correct answer, every course has a
            lesson, no blocked users.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {attention.map((row) => (
              <li key={row.text}>
                <Link
                  href={row.href}
                  className="flex items-center gap-3 rounded-sm border border-ink-200 bg-paper-raised px-4 py-3 hover:bg-ink-100"
                >
                  <span className="font-mono text-[15px] text-warning">
                    {row.count}
                  </span>
                  <span className="text-[14px] text-ink-900">{row.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
