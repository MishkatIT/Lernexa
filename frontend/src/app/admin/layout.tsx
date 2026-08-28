import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { dashboardPathFor } from "@/lib/roles";
import { AppShell, type NavItem } from "@/components/site/AppShell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/manage/courses", label: "All content" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("admin");
  return (
    <AppShell
      nav={NAV}
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
