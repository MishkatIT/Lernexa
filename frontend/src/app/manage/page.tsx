import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getInstructorSnapshot, getWorklist } from "@/lib/manage-home";

export const metadata: Metadata = { title: "Manage" };

export default async function ManageHomePage() {
  const user = await getCurrentUser();
  const isInstructor = user?.role?.type === "instructor";

  return isInstructor ? (
    <InstructorHome userId={user!.id} />
  ) : (
    <ManagerHome />
  );
}

async function InstructorHome({ userId }: { userId: number }) {
  const snap = await getInstructorSnapshot(userId);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Which students are stuck?
      </h1>

      <section className="mt-6">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-500">
          Stuck — 0% after a week
        </h2>
        {snap.stuckStudents.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-500">
            No one&apos;s stuck. Every enrolled student has started.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {snap.stuckStudents.map((s, i) => (
              <li
                key={i}
                className="flex justify-between rounded-sm border border-ink-200 bg-paper-raised px-4 py-2 text-[14px]"
              >
                <span className="text-ink-900">{s.name}</span>
                <Link
                  href={`/manage/courses/${s.courseId}`}
                  className="text-ink-500 hover:text-ink-900"
                >
                  {s.course} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {snap.strugglingCourses.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-500">
            Courses under 30% average completion
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {snap.strugglingCourses.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-sm border border-ink-200 bg-paper-raised px-4 py-2 text-[14px]"
              >
                <Link
                  href={`/manage/courses/${c.id}`}
                  className="text-ink-900 hover:underline"
                >
                  {c.title}
                </Link>
                <span className="font-mono text-ink-500">
                  {c.avgPercent}% · {c.enrolled} enrolled
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-500">
            Your courses
          </h2>
          <Link href="/manage/courses" className="text-[13px] text-accent-600 hover:underline">
            Manage →
          </Link>
        </div>
        <ul className="mt-2 flex flex-col gap-1">
          {snap.courses.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-sm border border-ink-200 bg-paper-raised px-4 py-2 text-[14px]"
            >
              <Link href={`/manage/courses/${c.id}`} className="text-ink-900 hover:underline">
                {c.title}
              </Link>
              <span className="font-mono text-ink-500">
                {c.enrolled} enrolled · {c.lessons} lesson{c.lessons === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function ManagerHome() {
  const work = await getWorklist();
  const rows: { label: string; items: { id: string; title: string }[]; fix: (id: string) => string }[] = [
    { label: "Courses with no lessons", items: work.noLessons, fix: (id) => `/manage/courses/${id}` },
    { label: "Courses with no quiz", items: work.noQuiz, fix: (id) => `/manage/courses/${id}` },
    { label: "Drafts older than a week", items: work.staleDrafts, fix: (id) => `/manage/blog/${id}` },
  ];
  const clean = rows.every((r) => r.items.length === 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        What content needs work?
      </h1>

      {clean ? (
        <p className="mt-6 text-[15px] text-ink-500">
          Nothing on the worklist. Every course has lessons and a quiz, no stale
          drafts.
        </p>
      ) : (
        rows
          .filter((r) => r.items.length > 0)
          .map((r) => (
            <section key={r.label} className="mt-6">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-500">
                {r.label} ({r.items.length})
              </h2>
              <ul className="mt-2 flex flex-col gap-1">
                {r.items.map((it) => (
                  <li key={it.id}>
                    <Link
                      href={r.fix(it.id)}
                      className="flex items-center justify-between rounded-sm border border-ink-200 bg-paper-raised px-4 py-2 text-[14px] hover:bg-ink-100"
                    >
                      <span className="text-ink-900">{it.title}</span>
                      <span className="text-ink-500">Fix →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}

      <div className="mt-8 flex gap-3 text-[13px]">
        <Link href="/manage/courses" className="text-accent-600 hover:underline">
          All courses →
        </Link>
        <Link href="/manage/blog" className="text-accent-600 hover:underline">
          Blog →
        </Link>
      </div>
    </div>
  );
}
