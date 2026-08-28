import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("student");

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Your dashboard
      </h1>
      <p className="mt-1 text-[15px] text-ink-500">
        Signed in as {user.fullName ?? user.username}. The resume card, My Courses
        and recent quiz scores arrive in Phase 4.
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
