import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getInstructorSnapshot, getWorklist } from "@/lib/manage-home";
import { relativeTime } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Manage" };

export default async function ManageHomePage() {
  const user = await getCurrentUser();
  const isInstructor = user?.role?.type === "instructor";

  return isInstructor ? <InstructorHome /> : <ManagerHome />;
}

/* -------------------------------------------------------------------------- */

async function InstructorHome() {
  const snap = await getInstructorSnapshot();
  const t = snap.totals;

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        as="h1"
        eyebrow="Instructor"
        title="Which students are stuck?"
        description="Exceptions first — the students and courses that need a nudge."
        action={
          <ButtonLink href="/manage/courses/new" size="sm">
            New course
          </ButtonLink>
        }
      />

      {snap.courses.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="You haven't created a course yet"
            description="Create a course, add lessons and a quiz, and it appears in the catalogue for students to enrol."
            action={{ label: "Create your first course", href: "/manage/courses/new" }}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-ink-200 py-6 sm:grid-cols-4">
            <Stat label="Courses" value={t.courses} />
            <Stat label="Students" value={t.students} />
            <Stat label="Lessons" value={t.lessons} />
            <Stat label="Avg completion" value={`${t.avgPercent}%`} />
          </div>

          <section className="mt-10">
            <h2 className="text-h3 text-ink-900">Stuck — 0% after a week</h2>
            {snap.stuckStudents.length === 0 ? (
              <p className="mt-2 text-body text-ink-500">
                No one&apos;s stuck. Every enrolled student has started.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {snap.stuckStudents.map((s, i) => (
                  <li key={i}>
                    <Card
                      as={Link}
                      href={`/manage/courses/${s.courseId}`}
                      interactive
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="text-body text-ink-900">{s.name}</span>
                        <span className="ml-2 text-small text-ink-500">
                          {s.course}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-small text-ink-500">
                        enrolled {relativeTime(s.enrolledAt)}
                      </span>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {snap.strugglingCourses.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-h3 text-ink-900">
                Courses under 30% average completion
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {snap.strugglingCourses.map((c) => (
                  <li key={c.id}>
                    <Card
                      as={Link}
                      href={`/manage/courses/${c.id}`}
                      interactive
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 truncate text-body text-ink-900">
                        {c.title}
                      </span>
                      <span className="shrink-0 font-mono text-small text-ink-500">
                        {c.avgPercent}% · {c.enrolled} enrolled
                      </span>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10">
            <SectionHeader
              title="Your courses"
              action={
                <Link
                  href="/manage/courses"
                  className="text-small text-accent-600 hover:underline"
                >
                  Manage all →
                </Link>
              }
            />
            <ul className="mt-5 flex flex-col gap-2">
              {snap.courses.map((c) => (
                <li key={c.id}>
                  <Card
                    as={Link}
                    href={`/manage/courses/${c.id}`}
                    interactive
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-body font-medium text-ink-900">
                      {c.title}
                    </span>
                    <span className="shrink-0 font-mono text-small text-ink-500">
                      {c.enrolled} enrolled · {c.lessons} lesson
                      {c.lessons === 1 ? "" : "s"}
                      {c.enrolled > 0 ? ` · ${c.avgPercent}%` : ""}
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function ManagerHome() {
  const work = await getWorklist();
  const t = work.totals;
  const groups = [
    { label: "Courses with no lessons", items: work.noLessons, base: "/manage/courses/" },
    { label: "Courses with no quiz", items: work.noQuiz, base: "/manage/courses/" },
    { label: "Drafts older than a week", items: work.staleDrafts, base: "/manage/blog/" },
  ];
  const clean = groups.every((g) => g.items.length === 0);

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        as="h1"
        eyebrow="Content"
        title="What content needs work?"
        description="Gaps in the catalogue and the blog — each row links straight to the fix."
        action={
          <div className="flex gap-2">
            <ButtonLink
              href="/manage/courses/new"
              size="sm"
              variant="secondary"
            >
              New course
            </ButtonLink>
            <ButtonLink href="/manage/blog/new" size="sm">
              New post
            </ButtonLink>
          </div>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-ink-200 py-6 sm:grid-cols-4">
        <Stat label="Courses" value={t.courses} />
        <Stat label="Lessons" value={t.lessons} />
        <Stat label="Published" value={t.published} />
        <Stat label="Drafts" value={t.drafts} />
      </div>

      <section className="mt-10">
        <h2 className="text-h3 text-ink-900">Worklist</h2>
        {clean ? (
          <p className="mt-2 text-body text-ink-500">
            Nothing on the worklist. Every course has lessons and a quiz, and
            there are no stale drafts.
          </p>
        ) : (
          groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.label} className="mt-5">
                <p className="text-small font-medium uppercase tracking-[0.14em] text-ink-500">
                  {g.label} ({g.items.length})
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <Card
                        as={Link}
                        href={`${g.base}${it.id}`}
                        interactive
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <span className="min-w-0 truncate text-body text-ink-900">
                          {it.title}
                        </span>
                        <span className="shrink-0 text-small text-accent-600">
                          Fix →
                        </span>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ))
        )}
      </section>

      {work.recentPosts.length > 0 ? (
        <section className="mt-10">
          <SectionHeader
            title="Recent posts"
            action={
              <Link
                href="/manage/blog"
                className="text-small text-accent-600 hover:underline"
              >
                All posts →
              </Link>
            }
          />
          <ul className="mt-5 divide-y divide-ink-200 overflow-hidden rounded-lg border border-ink-200">
            {work.recentPosts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 bg-paper-raised px-4 py-3"
              >
                <Link
                  href={`/manage/blog/${p.id}`}
                  className="min-w-0 truncate text-body text-ink-900 hover:underline"
                >
                  {p.title}
                </Link>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge tone={p.published ? "success" : "neutral"}>
                    {p.published ? "Published" : "Draft"}
                  </Badge>
                  <span className="font-mono text-small text-ink-500">
                    {relativeTime(p.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
