"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enrollInCourse } from "@/actions/learning";
import { Button } from "@/components/ui/Button";

export function EnrollButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await enrollInCourse(courseId);
          if (!res.ok) {
            setPending(false);
            setError(res.error);
            return;
          }
          router.push(`/learn/${courseId}`);
          router.refresh();
        }}
      >
        {pending ? "Enrolling…" : "Enrol"}
      </Button>
    </div>
  );
}
