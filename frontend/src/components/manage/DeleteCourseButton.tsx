"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCourse } from "@/actions/courses";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

export function DeleteCourseButton({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    const res = await deleteCourse(documentId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error); // includes the 409 "N students are enrolled" message
      setConfirming(false);
      return;
    }
    toast(`“${title}” deleted`);
    router.push("/manage/courses");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert>{error}</Alert> : null}
      {confirming ? (
        <div className="flex items-center gap-3">
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            {busy ? "Deleting…" : `Delete “${title}”`}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Delete this course
          </Button>
        </div>
      )}
    </div>
  );
}
