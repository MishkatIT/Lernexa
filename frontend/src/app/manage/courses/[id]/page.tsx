import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourseByDocumentId,
  getManagedLessons,
  getStudentProgress,
} from "@/lib/courses";
import { getCourseQuiz } from "@/lib/quiz";
import { shortDate } from "@/lib/format";
import { CourseForm } from "@/components/manage/CourseForm";
import { LessonManager } from "@/components/manage/LessonManager";
import { DeleteCourseButton } from "@/components/manage/DeleteCourseButton";
import { QuizBuilder } from "@/components/manage/QuizBuilder";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";

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
    <div className="mx-auto max-w-3xl">
      <Link
        href="/manage/courses"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Courses
      </Link>
      <h1 className="mt-3 text-display text-ink-900">{course.title}</h1>
      <p className="mt-1 text-body text-ink-500">
        {lessons.length} lesson{lessons.length === 1 ? "" : "s"} ·{" "}
        {students.length} student{students.length === 1 ? "" : "s"} ·{" "}
        {quiz ? "quiz set" : "no quiz"}
      </p>

      <section className="mt-10">
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

      <section className="mt-12">
        <h2 className="text-h3 text-ink-900">
          Lessons{" "}
          <span className="font-normal text-ink-500">
            ({lessons.length}, shown in order)
          </span>
        </h2>
        <div className="mt-4">
          <LessonManager courseDocumentId={course.documentId} lessons={lessons} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-h3 text-ink-900">Quiz</h2>
        <p className="mt-1 mb-4 text-small text-ink-500">
          One quiz per course. Each question needs exactly one correct option.
        </p>
        <QuizBuilder courseDocumentId={course.documentId} quiz={quiz} />
      </section>

      <section className="mt-12">
        <h2 className="text-h3 text-ink-900">
          Students{" "}
          <span className="font-normal text-ink-500">
            ({students.length}, least progress first)
          </span>
        </h2>
        {students.length === 0 ? (
          <p className="mt-3 text-body text-ink-500">No students enrolled yet.</p>
        ) : (
          <div className="mt-4 rounded-lg border border-ink-200">
            <Table>
              <THead>
                <Th>Student</Th>
                <Th className="w-44">Progress</Th>
                <Th>Lessons</Th>
                <Th>Last activity</Th>
              </THead>
              <TBody>
                {students.map((s) => (
                  <Tr key={s.student.id}>
                    <Td>{s.student.name}</Td>
                    <Td>
                      <ProgressBar
                        completed={s.progress.completed}
                        total={s.progress.total}
                      />
                    </Td>
                    <Td className="font-mono text-small text-ink-500">
                      {s.progress.completed}/{s.progress.total}
                    </Td>
                    <Td className="font-mono text-small text-ink-500">
                      {s.lastActivity ? shortDate(s.lastActivity) : "—"}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      <section className="mt-14 border-t border-ink-200 pt-6">
        <h2 className="text-h3 text-ink-900">Delete</h2>
        <p className="mt-1 mb-4 text-small text-ink-500">
          A course with enrolled students can&apos;t be deleted — remove the
          enrollments first.
        </p>
        <DeleteCourseButton documentId={course.documentId} title={course.title} />
      </section>
    </div>
  );
}
