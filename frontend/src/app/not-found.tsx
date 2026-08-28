import Link from "next/link";
import { BrandMark } from "@/components/Brand";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <BrandMark className="text-ink-500" />
      <p className="mt-6 font-mono text-small text-ink-500">404</p>
      <h1 className="mt-2 text-h1 text-ink-900">Not found</h1>
      <p className="mt-2 max-w-sm text-body text-ink-700">
        That page doesn&apos;t exist, or it isn&apos;t visible to you.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-md border border-ink-200 px-4 text-body font-medium text-ink-900 transition-colors hover:border-ink-500 hover:bg-ink-100"
      >
        Back home
      </Link>
    </div>
  );
}
