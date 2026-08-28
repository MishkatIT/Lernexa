import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/progress/ProgressBar";

export function ContinueCard({
  topic,
  lesson,
  completed,
  total,
  meta,
  href,
}: {
  topic: string;
  lesson: string;
  completed: number;
  total: number;
  meta?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-h3 text-ink-900">{topic}</p>
        <span className="shrink-0 font-mono text-small text-ink-500">
          {completed}/{total}
        </span>
      </div>
      <p className="mt-1 text-body text-ink-700">{lesson}</p>
      <div className="mt-3">
        <ProgressBar completed={completed} total={total} showLabel={false} />
      </div>
      <div className="mt-3 flex items-center justify-between text-small text-ink-500">
        <span>{meta ?? `Lesson ${completed} of ${total}`}</span>
        {href ? (
          <span className="font-medium text-accent-600">Continue →</span>
        ) : null}
      </div>
    </>
  );

  return href ? (
    <Card as={Link} href={href} interactive className="block p-5">
      {body}
    </Card>
  ) : (
    <Card className="p-5">{body}</Card>
  );
}
