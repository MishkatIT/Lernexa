import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS, dashboardPathFor, type RoleType } from "@/lib/roles";
import { BrandMark } from "@/components/Brand";

export const metadata: Metadata = { title: "Not allowed" };

/**
 * The state people skip. It names which role is required and which you have —
 * honest, and it shows the case was considered.
 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string }>;
}) {
  const need = (await searchParams).need;
  const user = await getCurrentUser();
  const have = user?.role?.type as RoleType | undefined;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <BrandMark className="text-ink-500" />
      <p className="mt-6 font-mono text-small text-ink-500">403</p>
      <h1 className="mt-2 text-h1 text-ink-900">You don&apos;t have access</h1>
      <p className="mt-2 max-w-sm text-body text-ink-700">
        {need
          ? `This area needs the ${ROLE_LABELS[need as RoleType] ?? need} role. `
          : "This area needs a different role. "}
        {have
          ? `You're signed in as ${ROLE_LABELS[have] ?? have}.`
          : "You're not signed in."}
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href={have ? dashboardPathFor(have) : "/login"}
          className="inline-flex h-10 items-center rounded-md bg-accent-600 px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-500"
        >
          {have ? "Your dashboard" : "Log in"}
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-ink-200 px-4 text-body font-medium text-ink-900 transition-colors hover:border-ink-500 hover:bg-ink-100"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
