import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseByDocumentId, getManagedLessons } from "@/lib/courses";
import { CourseForm } from "@/components/manage/CourseForm";
import { LessonManager } from "@/components/manage/LessonManager";
import { DeleteCourseButton } from "@/components/manage/DeleteCourseButton";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, lessons] = await Promise.all([
    getCourseByDocumentId(id),
    getManagedLessons(id),
  ]);
  if (!course) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/manage/courses" className="text-[13px] text-ink-500 hover:text-ink-900">
        ← Courses
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        {course.title}
      </h1>

      <section className="mt-6">
        <h2 className="text-[16px] font-semibold text-ink-900">Details</h2>
        <div className="mt-3">
          <CourseForm
            mode="edit"
            documentId={course.documentId}
            initial={{
              title: course.title,
              description: course.description ?? "",
              coverImageUrl: course.coverImageUrl ?? "",
            }}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[16px] font-semibold text-ink-900">
          Lessons{" "}
          <span className="font-normal text-ink-500">
            ({lessons.length}, shown in order)
          </span>
        </h2>
        <div className="mt-3">
          <LessonManager courseDocumentId={course.documentId} lessons={lessons} />
        </div>
      </section>

      <section className="mt-12 border-t border-ink-200 pt-6">
        <h2 className="text-[16px] font-semibold text-ink-900">Delete</h2>
        <p className="mt-1 mb-3 text-[13px] text-ink-500">
          A course with enrolled students can&apos;t be deleted — remove the
          enrollments first.
        </p>
        <DeleteCourseButton documentId={course.documentId} title={course.title} />
      </section>
    </div>
  );
}
