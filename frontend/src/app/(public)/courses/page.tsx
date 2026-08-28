import type { Metadata } from "next";
import Link from "next/link";
import { listCatalogue } from "@/lib/courses";

export const metadata: Metadata = { title: "Courses" };

export default async function CataloguePage() {
  const courses = await listCatalogue();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Courses</h1>
      <p className="mt-1 text-[15px] text-ink-500">
        {courses.length} course{courses.length === 1 ? "" : "s"} available.
      </p>

      {courses.length === 0 ? (
        <p className="mt-8 text-[15px] text-ink-500">
          No courses are published yet. Check back soon.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.documentId}>
              <Link
                href={`/courses/${c.slug ?? c.documentId}`}
                className="flex h-full flex-col rounded-sm border border-ink-200 bg-paper-raised p-5 hover:border-ink-500"
              >
                <span className="text-[16px] font-semibold text-ink-900">
                  {c.title}
                </span>
                {c.instructor?.fullName ? (
                  <span className="mt-0.5 text-[13px] text-ink-500">
                    {c.instructor.fullName}
                  </span>
                ) : null}
                {c.description ? (
                  <span className="mt-2 line-clamp-3 text-[14px] text-ink-700">
                    {c.description}
                  </span>
                ) : null}
                <span className="mt-3 text-[13px] text-ink-500">
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
