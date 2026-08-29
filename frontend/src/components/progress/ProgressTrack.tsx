import Link from "next/link";

/**
 * The signature component. One segment per lesson — filled = complete, ring =
 * current. Honest to the data model: it shows *which* lessons, not just a
 * percentage, and it doubles as navigation (docs/DESIGN_SYSTEM.md).
 *
 * D-038: in `open_locked` courses a lesson can be `locked` — shown with a lock
 * glyph and not linked, since the server won't serve its body yet anyway.
 */
export function ProgressTrack({
  courseId,
  lessons,
  currentLessonId,
}: {
  courseId: string;
  lessons: {
    id: string;
    title: string;
    order: number;
    completed: boolean;
    locked?: boolean;
  }[];
  currentLessonId?: string;
}) {
  const done = lessons.filter((l) => l.completed).length;

  return (
    <nav aria-label="Lessons" className="flex flex-col gap-1">
      <p className="mb-2 font-mono text-small text-ink-500">
        {done}/{lessons.length} complete
      </p>
      {lessons.map((lesson) => {
        const current = lesson.id === currentLessonId;
        const marker = (
          <span
            aria-hidden
            className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] ${
              lesson.completed
                ? "border-success bg-success text-on-accent"
                : lesson.locked
                  ? "border-ink-200 text-ink-500"
                  : current
                    ? "border-accent-500"
                    : "border-ink-200"
            }`}
          >
            {lesson.completed ? "✓" : lesson.locked ? "🔒" : ""}
          </span>
        );

        if (lesson.locked) {
          return (
            <div
              key={lesson.id}
              aria-disabled="true"
              title="Complete the earlier lessons to unlock this one"
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-body text-ink-500"
            >
              {marker}
              <span className="truncate">{lesson.title}</span>
            </div>
          );
        }

        return (
          <Link
            key={lesson.id}
            href={`/learn/${courseId}/${lesson.id}`}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-body ${
              current
                ? "bg-ink-100 font-medium text-ink-900"
                : "text-ink-700 hover:bg-ink-100"
            }`}
          >
            {marker}
            <span className="truncate">{lesson.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
