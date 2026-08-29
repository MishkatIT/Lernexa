import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { dashboardPathFor } from "@/lib/roles";
import { buildAppNav } from "@/lib/nav";
import { AppShell } from "@/components/site/AppShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("admin");
  return (
    <AppShell
      nav={buildAppNav(user.role?.type)}
      user={{
        name: user.fullName ?? user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        roleLabel: "Admin",
        dashboardPath: dashboardPathFor(user.role?.type),
      }}
    >
      {children}
    </AppShell>
  );
}
