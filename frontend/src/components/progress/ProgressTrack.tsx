import Link from "next/link";

/**
 * The signature component. One segment per lesson — filled = complete, ring =
 * current. Honest to the data model: it shows *which* lessons, not just a
 * percentage, and it doubles as navigation (docs/DESIGN_SYSTEM.md).
 */
export function ProgressTrack({
  courseId,
  lessons,
  currentLessonId,
}: {
  courseId: string;
  lessons: { id: string; title: string; order: number; completed: boolean }[];
  currentLessonId?: string;
}) {
  const done = lessons.filter((l) => l.completed).length;

  return (
    <nav aria-label="Lessons" className="flex flex-col gap-1">
      <p className="mb-2 font-mono text-[13px] text-ink-500">
        {done}/{lessons.length} complete
      </p>
      {lessons.map((lesson) => {
        const current = lesson.id === currentLessonId;
        return (
          <Link
            key={lesson.id}
            href={`/learn/${courseId}/${lesson.id}`}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-[14px] ${
              current
                ? "bg-ink-100 font-medium text-ink-900"
                : "text-ink-700 hover:bg-ink-100"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] ${
                lesson.completed
                  ? "border-success bg-success text-paper-raised"
                  : current
                    ? "border-accent-500"
                    : "border-ink-200"
              }`}
            >
              {lesson.completed ? "✓" : ""}
            </span>
            <span className="truncate">{lesson.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
