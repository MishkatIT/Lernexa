import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { AppShell, type NavItem } from "@/components/site/AppShell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/manage/courses", label: "All content" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("admin");
  return (
    <AppShell
      nav={NAV}
      user={{ name: user.fullName ?? user.username, roleLabel: "Admin" }}
    >
      {children}
    </AppShell>
  );
}
