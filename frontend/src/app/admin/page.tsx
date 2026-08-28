import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformStats, getRecentlyBlocked } from "@/lib/admin";
import { getRecentActivity, actionLabel } from "@/lib/audit";
import { relativeTime } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Stat } from "@/components/ui/Stat";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const [stats, recentlyBlocked, activity] = await Promise.all([
    getPlatformStats(),
    getRecentlyBlocked(),
    getRecentActivity(5),
  ]);

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
      href: "/manage/courses?filter=needs-quiz",
    },
    {
      text: "course(s) with no lessons",
      count: stats.attention.coursesWithoutLessons,
      href: "/manage/courses?filter=needs-lessons",
    },
  ].filter((row) => row.count > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader as="h1" eyebrow="Admin" title="What needs my attention" />

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-7 border-y border-ink-200 py-6 sm:grid-cols-3 lg:grid-cols-5">
        {strip.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href="/admin/users" size="sm" variant="secondary">
          Manage users
        </ButtonLink>
        <ButtonLink href="/admin/settings" size="sm" variant="secondary">
          Site settings
        </ButtonLink>
        <ButtonLink href="/manage/courses" size="sm" variant="secondary">
          All content
        </ButtonLink>
        <ButtonLink href="/manage/blog" size="sm" variant="secondary">
          Blog
        </ButtonLink>
      </div>

      <section className="mt-10">
        <h2 className="text-h3 text-ink-900">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-body text-ink-500">
            Nothing flagged. Every quiz has a correct answer and every course has
            a lesson.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {attention.map((row) => (
              <li key={row.text}>
                <Card
                  as={Link}
                  href={row.href}
                  interactive
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="font-mono text-body text-warning">
                    {row.count}
                  </span>
                  <span className="text-body text-ink-900">{row.text}</span>
                  <span className="ml-auto text-small text-accent-600">
                    Review →
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Recently blocked"
          action={
            stats.users.blocked > 0 ? (
              <Link
                href="/admin/users?status=blocked"
                className="text-small text-accent-600 hover:underline"
              >
                All blocked →
              </Link>
            ) : undefined
          }
        />
        {recentlyBlocked.length === 0 ? (
          <p className="mt-2 text-body text-ink-500">
            No blocked accounts.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-ink-200 overflow-hidden rounded-lg border border-ink-200">
            {recentlyBlocked.map((u) => (
              <li
                key={u.id}
                className="flex items-start justify-between gap-4 bg-paper-raised px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-body text-ink-900">
                    {u.fullName ?? u.username}
                    <span className="ml-2 font-mono text-small text-ink-500">
                      {u.email}
                    </span>
                  </p>
                  {u.blockedReason ? (
                    <p className="mt-0.5 truncate text-small text-ink-500">
                      {u.blockedReason}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-small text-ink-500">
                  {relativeTime(u.blockedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Recent activity"
          action={
            <Link
              href="/admin/audit"
              className="text-small text-accent-600 hover:underline"
            >
              Full log →
            </Link>
          }
        />
        {activity.length === 0 ? (
          <p className="mt-2 text-body text-ink-500">
            Nothing logged yet. Security and content changes show up here.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-ink-200 overflow-hidden rounded-lg border border-ink-200">
            {activity.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 bg-paper-raised px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Badge
                    tone={e.category === "security" ? "warning" : "neutral"}
                  >
                    {e.category}
                  </Badge>
                  <span className="min-w-0 truncate text-body text-ink-900">
                    {actionLabel(e.action)}
                    {e.targetLabel ? (
                      <span className="text-ink-500"> · {e.targetLabel}</span>
                    ) : null}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-small text-ink-500">
                  {relativeTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
