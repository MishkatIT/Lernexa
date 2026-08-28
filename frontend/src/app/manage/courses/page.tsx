import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { listManagedCourses } from "@/lib/courses";

export const metadata: Metadata = { title: "Courses" };

export default async function ManageCoursesPage() {
  const user = await getCurrentUser();
  const scopeToSelf = user?.role?.type === "instructor";
  const courses = await listManagedCourses(scopeToSelf ? user!.id : undefined);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            {scopeToSelf ? "Your courses" : "All courses"}
          </h1>
          <p className="mt-1 text-[15px] text-ink-500">
            {courses.length} course{courses.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          href="/manage/courses/new"
          className="rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
        >
          New course
        </Link>
      </div>

      {courses.length === 0 ? (
        <p className="mt-8 text-[15px] text-ink-500">
          Nothing here yet. Create your first course — you&apos;ll add lessons to
          it next.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {courses.map((c) => (
            <li key={c.documentId}>
              <Link
                href={`/manage/courses/${c.documentId}`}
                className="flex items-center justify-between rounded-sm border border-ink-200 bg-paper-raised px-4 py-3 hover:bg-ink-100"
              >
                <span>
                  <span className="text-[15px] font-medium text-ink-900">
                    {c.title}
                  </span>
                  {!scopeToSelf && c.instructor?.fullName ? (
                    <span className="ml-2 text-[13px] text-ink-500">
                      {c.instructor.fullName}
                    </span>
                  ) : null}
                </span>
                <span className="text-[13px] text-ink-500">
                  {c.lessons.length} lesson{c.lessons.length === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
