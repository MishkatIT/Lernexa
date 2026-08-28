import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseBySlug, getCourseByDocumentId } from "@/lib/courses";
import { getCurrentUser } from "@/lib/session";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const course = (await getCourseBySlug(slug)) ?? (await getCourseByDocumentId(slug));
  return { title: course?.title ?? "Course" };
}

export default async function CourseDetailPage({ params }: Params) {
  const { slug } = await params;
  const course =
    (await getCourseBySlug(slug)) ?? (await getCourseByDocumentId(slug));
  if (!course) notFound();

  const user = await getCurrentUser();
  const lessons = [...course.lessons].sort((a, b) => a.order - b.order);

  return (
    <article className="max-w-2xl">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink-900">
        {course.title}
      </h1>
      {course.instructor?.fullName ? (
        <p className="mt-1 text-[14px] text-ink-500">
          Taught by {course.instructor.fullName}
        </p>
      ) : null}

      {course.description ? (
        <p className="mt-4 text-[15px] text-ink-700">{course.description}</p>
      ) : null}

      <div className="mt-6">
        {!user ? (
          <Link
            href={`/login?returnTo=/courses/${course.slug ?? course.documentId}`}
            className="rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
          >
            Log in to enrol
          </Link>
        ) : user.role?.type === "student" ? (
          <span className="text-[13px] text-ink-500">
            Enrolment opens in Phase 4.
          </span>
        ) : (
          <span className="text-[13px] text-ink-500">
            Only students can enrol.
          </span>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-500">
          {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
        </h2>
        <ol className="mt-3 flex flex-col gap-1">
          {lessons.map((l) => (
            <li
              key={`${l.order}-${l.title}`}
              className="flex items-center gap-3 rounded-sm border border-ink-200 bg-paper-raised px-4 py-2.5"
            >
              <span className="font-mono text-[13px] text-ink-500">
                {String(l.order).padStart(2, "0")}
              </span>
              <span className="text-[15px] text-ink-900">{l.title}</span>
              <span className="ml-auto text-[12px] text-ink-500">Locked</span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
