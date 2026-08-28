import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformStats } from "@/lib/admin";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stat } from "@/components/ui/Stat";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const stats = await getPlatformStats();

  const strip = [
    { label: "Users", value: stats.users.total },
    { label: "Instructors", value: stats.users.instructors },
    { label: "Students", value: stats.users.students },
    { label: "Blocked", value: stats.users.blocked },
    { label: "Active · 7d", value: stats.users.activeLast7Days },
    { label: "Courses", value: stats.content.courses },
    { label: "Enrollments", value: stats.content.enrollments },
    { label: "Quiz attempts", value: stats.content.quizAttempts },
    {
      label: "Avg completion",
      value: `${stats.content.overallCompletionPercent}%`,
    },
  ];

  const attention = [
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
      <SectionHeader
        as="h1"
        eyebrow="Admin"
        title="What needs my attention"
      />

      <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-8 border-y border-ink-200 py-6 sm:grid-cols-5">
        {strip.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-h3 text-ink-900">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-body text-ink-500">
            Nothing flagged. Every quiz has a correct answer, every course has a
            lesson, no blocked users.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {attention.map((row) => (
              <li key={row.text}>
                <Link
                  href={row.href}
                  className="flex items-center gap-3 rounded-lg border border-ink-200 bg-paper-raised px-4 py-3 transition-colors hover:border-ink-500"
                >
                  <span className="font-mono text-body text-warning">
                    {row.count}
                  </span>
                  <span className="text-body text-ink-900">{row.text}</span>
                  <span className="ml-auto text-small text-ink-500">Fix →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
