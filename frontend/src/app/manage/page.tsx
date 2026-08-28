import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { ROLE_LABELS, type RoleType } from "@/lib/roles";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = { title: "Manage" };

export default async function ManagePage() {
  const user = await requireRole("instructor", "content-manager");

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Manage
      </h1>
      <p className="mt-1 text-[15px] text-ink-500">
        Signed in as {user.fullName ?? user.username} —{" "}
        {ROLE_LABELS[user.role?.type as RoleType]}. Course, lesson and quiz
        management arrives in Phase 3.
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
