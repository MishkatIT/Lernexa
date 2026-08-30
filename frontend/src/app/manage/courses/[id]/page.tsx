import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourseByDocumentId,
  getManagedLessons,
  getStudentProgress,
  ROSTER_DEFAULT_PAGE_SIZE,
  ROSTER_PAGE_SIZES,
} from "@/lib/courses";
import { getCourseQuiz } from "@/lib/quiz";
import { CourseForm } from "@/components/manage/CourseForm";
import { CoursePublishControl } from "@/components/manage/CoursePublishControl";
import { LessonManager } from "@/components/manage/LessonManager";
import { DeleteCourseButton } from "@/components/manage/DeleteCourseButton";
import { QuizBuilder } from "@/components/manage/QuizBuilder";
import { RosterManager } from "@/components/manage/RosterManager";
import { OnThisPage } from "@/components/ui/OnThisPage";

export const metadata: Metadata = { title: "Edit course" };

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "publish", label: "Publish" },
  { id: "lessons", label: "Lessons" },
  { id: "quiz", label: "Quiz" },
  { id: "students", label: "Students" },
  { id: "delete", label: "Delete" },
];

export default async function EditCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ students_page?: string; students_per?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rosterPageSize = ROSTER_PAGE_SIZES.includes(
    Number(sp.students_per) as (typeof ROSTER_PAGE_SIZES)[number],
  )
    ? Number(sp.students_per)
    : ROSTER_DEFAULT_PAGE_SIZE;
  const rosterPage = Math.max(1, Number(sp.students_page) || 1);

  const [course, lessons, roster, quiz] = await Promise.all([
    getCourseByDocumentId(id),
    getManagedLessons(id),
    getStudentProgress(id, { page: rosterPage, pageSize: rosterPageSize }),
    getCourseQuiz(id),
  ]);
  if (!course) notFound();

  return (
    <div className="mx-auto max-w-3xl xl:max-w-[60rem]">
      <Link
        href="/manage/courses"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Courses
      </Link>
      <h1 className="mt-3 text-display text-ink-900">{course.title}</h1>
      <p className="mt-1 text-body text-ink-500">
        {lessons.length} lesson{lessons.length === 1 ? "" : "s"} ·{" "}
        {roster.total} student{roster.total === 1 ? "" : "s"} ·{" "}
        {quiz ? "quiz set" : "no quiz"}
      </p>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_11rem] xl:gap-12">
        <div className="min-w-0">
          <section id="details" className="mt-10 scroll-mt-24">
            <h2 className="text-h3 text-ink-900">Details</h2>
            <div className="mt-4">
              <CourseForm
                mode="edit"
                documentId={course.documentId}
                initial={{
                  title: course.title,
                  description: course.description ?? "",
                  coverImageUrl: course.coverImageUrl ?? "",
                  lessonProgression: course.lessonProgression ?? "free",
                }}
              />
            </div>
          </section>

          <section id="publish" className="mt-12 scroll-mt-24">
            <h2 className="text-h3 text-ink-900">Publish</h2>
            <p className="mt-1 mb-4 text-small text-ink-500">
              Controls who can see and enrol in this course.
            </p>
            <CoursePublishControl
              documentId={course.documentId}
              status={course.status}
              publishedLessonCount={lessons.filter((l) => l.published).length}
            />
          </section>

          <section id="lessons" className="mt-12 scroll-mt-24">
            <h2 className="text-h3 text-ink-900">
              Lessons{" "}
              <span className="font-normal text-ink-500">
                ({lessons.length}, shown in order)
              </span>
            </h2>
            <div className="mt-4">
              <LessonManager
                courseDocumentId={course.documentId}
                lessons={lessons}
              />
            </div>
          </section>

          <section id="quiz" className="mt-12 scroll-mt-24">
            <h2 className="text-h3 text-ink-900">Quiz</h2>
            <p className="mt-1 mb-4 text-small text-ink-500">
              One quiz per course. Each question needs exactly one correct
              option.
            </p>
            <QuizBuilder courseDocumentId={course.documentId} quiz={quiz} />
          </section>

          <section id="students" className="mt-12 scroll-mt-24">
            <h2 className="text-h3 text-ink-900">
              Students{" "}
              <span className="font-normal text-ink-500">
                ({roster.total}, least progress first)
              </span>
            </h2>
            <RosterManager
              courseDocumentId={course.documentId}
              rows={roster.rows}
              total={roster.total}
              page={roster.page}
              pageSize={roster.pageSize}
              pageCount={roster.pageCount}
            />
          </section>

          <section
            id="delete"
            className="mt-14 scroll-mt-24 border-t border-ink-200 pt-6"
          >
            <h2 className="text-h3 text-ink-900">Delete</h2>
            <p className="mt-1 mb-4 text-small text-ink-500">
              A course with enrolled students can&apos;t be deleted — remove them
              in the Students section above first.
            </p>
            <DeleteCourseButton
              documentId={course.documentId}
              title={course.title}
            />
          </section>
        </div>

        <OnThisPage sections={SECTIONS} className="mt-10" />
      </div>
    </div>
  );
}
