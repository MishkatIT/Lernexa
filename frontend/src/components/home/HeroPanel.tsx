import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/progress/ProgressBar";

/**
 * The hero's product visual — a simplified slice of the real learning UI, not
 * an illustration. It says: "Lernexa helps me make progress."
 */
export function HeroPanel({
  topic,
  lesson,
  completed,
  total,
  streakDays,
  continueHref = "/courses",
}: {
  topic: string;
  lesson: string;
  completed: number;
  total: number;
  streakDays?: number;
  continueHref?: string;
}) {
  return (
    <Card className="w-full max-w-md p-6">
      <p className="text-small font-medium uppercase tracking-[0.14em] text-accent-600">
        Learning today
      </p>

      <p className="mt-3 text-h3 text-ink-900">{topic}</p>

      <div className="mt-3">
        <ProgressBar completed={completed} total={total} />
      </div>

      <div className="my-5 border-t border-ink-200" />

      <p className="text-small text-ink-500">Current lesson</p>
      <p className="mt-1 text-body text-ink-900">{lesson}</p>

      <Link
        href={continueHref}
        className="mt-4 inline-flex items-center gap-1.5 text-small font-medium text-accent-600 transition-colors hover:text-accent-500"
      >
        Continue learning
        <span aria-hidden>→</span>
      </Link>

      {streakDays ? (
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1 text-small text-ink-700">
          <span aria-hidden>🔥</span>
          {streakDays} day streak
        </div>
      ) : null}
    </Card>
  );
}
