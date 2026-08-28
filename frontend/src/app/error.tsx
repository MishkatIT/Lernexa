"use client";

import { useEffect } from "react";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <BrandMark className="text-ink-500" />
      <h1 className="mt-6 text-h1 text-ink-900">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-body text-ink-700">
        We couldn&apos;t load this page. Try again — if it keeps happening, the
        API may be unavailable.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
