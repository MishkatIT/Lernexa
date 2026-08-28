import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireRole("admin");

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Admin</h1>
      <p className="mt-1 text-[15px] text-ink-500">
        Signed in as {user.fullName ?? user.username}. The stats strip, attention
        queue and user management arrive in Phase 6.
      </p>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
