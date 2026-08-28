import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { ROLE_LABELS, dashboardPathFor, type RoleType } from "@/lib/roles";
import { AppShell, type NavItem } from "@/components/site/AppShell";

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("instructor", "content-manager", "admin");
  const canBlog =
    user.role?.type === "admin" || user.role?.type === "content-manager";

  const nav: NavItem[] = [
    { href: "/manage", label: "Overview" },
    { href: "/manage/courses", label: "Courses" },
    ...(canBlog ? [{ href: "/manage/blog", label: "Blog" }] : []),
    { href: "/courses", label: "Public catalogue" },
  ];

  return (
    <AppShell
      nav={nav}
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
