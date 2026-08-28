import type { Metadata } from "next";
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
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside
        data-surface
        className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[280px] shrink-0 overflow-y-auto border-r border-ink-200 bg-paper-raised p-5 lg:block"
      >
        <p className="text-small font-medium uppercase tracking-[0.12em] text-ink-500">
          {ctx.course.title}
        </p>
        <div className="mt-4">
          <ProgressTrack
            courseId={courseId}
            lessons={ctx.lessons}
            currentLessonId={lesson.id}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile: the track collapses to a compact strip above the content. */}
        <div
          data-surface
          className="border-b border-ink-200 bg-paper-raised px-6 py-3 lg:hidden"
        >
          <p className="font-mono text-small text-ink-500">
            {ctx.course.title} · Lesson {index + 1} of {ctx.lessons.length} ·{" "}
            {ctx.progress.percent}% complete
          </p>
          <div className="mt-2 flex gap-1">
            {ctx.lessons.map((l) => (
              <span
                key={l.id}
                className={`h-1.5 flex-1 rounded-full ${
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
