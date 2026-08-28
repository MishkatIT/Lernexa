import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <p className="font-mono text-[13px] text-ink-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        Not found
      </h1>
      <p className="mt-2 text-[15px] text-ink-700">
        That page doesn&apos;t exist, or it isn&apos;t visible to you.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-sm border border-ink-200 px-4 py-2 text-[15px] font-medium text-ink-900 hover:bg-ink-100"
      >
        Home
      </Link>
    </div>
  );
}
