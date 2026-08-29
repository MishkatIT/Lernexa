import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { ROLE_LABELS, dashboardPathFor, type RoleType } from "@/lib/roles";
import { buildAppNav } from "@/lib/nav";
import { AppShell } from "@/components/site/AppShell";

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("instructor", "content-manager", "admin");

  return (
    <AppShell
      nav={buildAppNav(user.role?.type)}
      user={{
        name: user.fullName ?? user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        roleLabel: ROLE_LABELS[user.role?.type as RoleType] ?? "",
        dashboardPath: dashboardPathFor(user.role?.type),
      }}
    >
      {children}
    </AppShell>
  );
}
