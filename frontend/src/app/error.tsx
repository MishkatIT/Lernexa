"use client";

import { useEffect } from "react";

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
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-[15px] text-ink-700">
        The page hit an error. Try again — if it keeps happening, the API may be
        down.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
      >
        Try again
      </button>
    </div>
  );
}
