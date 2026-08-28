import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourseByDocumentId,
  getManagedLessons,
  getStudentProgress,
} from "@/lib/courses";
import { getCourseQuiz } from "@/lib/quiz";
import { CourseForm } from "@/components/manage/CourseForm";
import { LessonManager } from "@/components/manage/LessonManager";
import { DeleteCourseButton } from "@/components/manage/DeleteCourseButton";
import { QuizBuilder } from "@/components/manage/QuizBuilder";
import { ProgressBar } from "@/components/progress/ProgressBar";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, lessons, students, quiz] = await Promise.all([
    getCourseByDocumentId(id),
    getManagedLessons(id),
    getStudentProgress(id),
    getCourseQuiz(id),
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

      <section className="mt-10">
        <h2 className="text-[16px] font-semibold text-ink-900">Quiz</h2>
        <p className="mt-1 mb-3 text-[13px] text-ink-500">
          One quiz per course. Each question needs exactly one correct option.
        </p>
        <QuizBuilder courseDocumentId={course.documentId} quiz={quiz} />
      </section>

      <section className="mt-10">
        <h2 className="text-[16px] font-semibold text-ink-900">
          Students{" "}
          <span className="font-normal text-ink-500">
            ({students.length}, least progress first)
          </span>
        </h2>
        {students.length === 0 ? (
          <p className="mt-2 text-[15px] text-ink-500">No students enrolled yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Progress</th>
                  <th className="py-2 pr-4 font-medium">Lessons</th>
                  <th className="py-2 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.student.id} className="border-t border-ink-200">
                    <td className="py-2.5 pr-4 text-ink-900">{s.student.name}</td>
                    <td className="w-40 py-2.5 pr-4">
                      <ProgressBar
                        completed={s.progress.completed}
                        total={s.progress.total}
                      />
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-ink-500">
                      {s.progress.completed}/{s.progress.total}
                    </td>
                    <td className="py-2.5 font-mono text-[13px] text-ink-500">
                      {s.lastActivity
                        ? new Date(s.lastActivity).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
