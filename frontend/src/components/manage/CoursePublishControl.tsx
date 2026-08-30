"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishCourse, unpublishCourse } from "@/actions/courses";
import type { CourseStatus } from "@/lib/courses";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

const META: Record<
  CourseStatus,
  { badge: "success" | "warning" | "neutral"; label: string; line: string }
> = {
  published: {
    badge: "success",
    label: "Published",
    line: "In the public catalogue and open for enrolment.",
  },
  enrolled_only: {
    badge: "warning",
    label: "Enrolled only",
    line: "Hidden from the catalogue. Current students keep learning; nobody new can enrol.",
  },
  draft: {
    badge: "neutral",
    label: "Draft",
    line: "Visible only to you. No student can open it, enrolled or not.",
  },
};

export function CoursePublishControl({
  documentId,
  status,
  publishedLessonCount,
}: {
  documentId: string;
  status: CourseStatus;
  publishedLessonCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMessage: string,
  ) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    toast(okMessage);
    router.refresh();
  }

  const meta = META[status];

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert>{error}</Alert> : null}

      <div className="flex items-center gap-2">
        <Badge tone={meta.badge}>{meta.label}</Badge>
        <span className="text-small text-ink-500">{meta.line}</span>
      </div>

      {status !== "published" && publishedLessonCount === 0 ? (
        <p className="text-small text-warning">
          This course has no published lessons yet — students will see an empty
          course until you add one.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {status !== "published" ? (
          <Button
            disabled={busy}
            onClick={() =>
              run(() => publishCourse(documentId), "Course published")
            }
          >
            Publish
          </Button>
        ) : null}

        {status === "published" ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => unpublishCourse(documentId, "enrolled_only"),
                "Course restricted to enrolled students",
              )
            }
          >
            Restrict to enrolled
          </Button>
        ) : null}

        {status !== "draft" ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run(
                () => unpublishCourse(documentId, "draft"),
                "Course moved to draft",
              )
            }
          >
            {status === "published" ? "Unpublish" : "Move to draft"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
