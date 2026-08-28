import Link from "next/link";
import { Card } from "./Card";
import { ProgressBar } from "@/components/progress/ProgressBar";

/** Rough estimate for the card — ~8 min per lesson, rounded to the half hour. */
function estimateHours(lessons: number) {
  const mins = lessons * 8;
  if (mins < 45) return `~${Math.max(15, Math.round(mins / 5) * 5)} min`;
  return `~${Math.round(mins / 30) / 2}h`;
}

export function CourseCard({
  href,
  title,
  instructor,
  description,
  lessons,
  progress,
}: {
  href: string;
  title: string;
  instructor?: string | null;
  description?: string | null;
  lessons: number;
  progress?: { completed: number; total: number } | null;
}) {
  return (
    <Card as={Link} href={href} interactive className="flex flex-col p-5">
      <p className="text-h3 text-ink-900">{title}</p>
      {instructor ? (
        <p className="mt-1 text-small text-ink-500">Taught by {instructor}</p>
      ) : null}

      {description ? (
        <p className="mt-2.5 line-clamp-2 text-body text-ink-700">
          {description}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-small text-ink-500">
        <span>
          {lessons} lesson{lessons === 1 ? "" : "s"}
        </span>
        {lessons > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>{estimateHours(lessons)}</span>
          </>
        ) : null}
      </div>

      {progress && progress.total > 0 ? (
        <div className="mt-3">
          <ProgressBar
            completed={progress.completed}
            total={progress.total}
            size="sm"
            showLabel={false}
          />
          <p className="mt-2 text-small font-medium text-accent-600">
            Continue →
          </p>
        </div>
      ) : (
        <p className="mt-3 text-small font-medium text-accent-600">
          {lessons > 0 ? "Start →" : "Coming soon"}
        </p>
      )}
    </Card>
  );
}
