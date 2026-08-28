import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getLearnContext } from "@/lib/learning";
import { ProgressTrack } from "@/components/progress/ProgressTrack";
import { LessonViewer } from "@/components/learn/LessonViewer";

type Params = { params: Promise<{ courseId: string; lessonId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { courseId, lessonId } = await params;
  const ctx = await getLearnContext(courseId);
  const lesson = ctx?.lessons.find((l) => l.id === lessonId);
  return { title: lesson ? `${lesson.title} · ${ctx!.course.title}` : "Lesson" };
}

export default async function LessonPage({ params }: Params) {
  await requireRole("student");
  const { courseId, lessonId } = await params;

  const ctx = await getLearnContext(courseId);
  if (!ctx) redirect(`/courses/${courseId}`);

  const index = ctx.lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();

  const lesson = ctx.lessons[index];
  const prev = ctx.lessons[index - 1] ?? null;
  const next = ctx.lessons[index + 1] ?? null;

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-[280px] shrink-0 border-r border-ink-200 bg-paper-raised p-5 lg:block">
        <Link
          href="/dashboard"
          className="text-[13px] text-ink-500 hover:text-ink-900"
        >
          ← Dashboard
        </Link>
        <p className="mt-4 mb-3 text-[15px] font-semibold text-ink-900">
          {ctx.course.title}
        </p>
        <ProgressTrack
          courseId={courseId}
          lessons={ctx.lessons}
          currentLessonId={lesson.id}
        />
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile: the track collapses to a compact strip above the content. */}
        <div className="border-b border-ink-200 bg-paper-raised px-6 py-3 lg:hidden">
          <p className="font-mono text-[13px] text-ink-500">
            {ctx.course.title} · Lesson {index + 1} of {ctx.lessons.length} ·{" "}
            {ctx.progress.percent}% complete
          </p>
          <div className="mt-2 flex gap-1">
            {ctx.lessons.map((l) => (
              <span
                key={l.id}
                className={`h-1.5 flex-1 rounded-sm ${
                  l.completed
                    ? "bg-success"
                    : l.id === lesson.id
                      ? "bg-accent-500"
                      : "bg-ink-100"
                }`}
              />
            ))}
          </div>
        </div>

        <LessonViewer
          courseId={courseId}
          lesson={lesson}
          prevId={prev?.id ?? null}
          nextId={next?.id ?? null}
          quizId={next ? null : ctx.quizId}
        />
      </div>
    </div>
  );
}
