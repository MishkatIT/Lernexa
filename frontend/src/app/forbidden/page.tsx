import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS, dashboardPathFor, type RoleType } from "@/lib/roles";

export const metadata: Metadata = { title: "Not allowed" };

/**
 * The state people skip. It says which role is required and which you have —
 * honest, and it shows the case was thought about (docs/DESIGN_SYSTEM.md).
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
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="font-mono text-[13px] text-ink-500">403</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        You don&apos;t have access to this
      </h1>
      <p className="mt-3 text-[15px] text-ink-700">
        {need
          ? `This area needs the ${
              ROLE_LABELS[need as RoleType] ?? need
            } role.`
          : "This area needs a different role."}{" "}
        {have
          ? `You're signed in as ${ROLE_LABELS[have] ?? have}.`
          : "You're not signed in."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href={have ? dashboardPathFor(have) : "/login"}
          className="rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
        >
          {have ? "Your dashboard" : "Log in"}
        </Link>
        <Link
          href="/"
          className="rounded-sm border border-ink-200 px-4 py-2 text-[15px] font-medium text-ink-900 hover:bg-ink-100"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
