import type { NavEntry, NavLeaf } from "@/components/site/AppShell";

/** The one place the app sidebar is defined. Both the /admin and /manage
 *  layouts render this so a user's nav stays identical as they move between
 *  the two route trees (an admin reaches /manage/* via the Content group and
 *  must not lose Dashboard/Users/Audit/Settings when they land there). */
export function buildAppNav(role: string | null | undefined): NavEntry[] {
  const canBlog = role === "admin" || role === "content-manager";

  const content: NavLeaf[] = [
    { href: "/manage/courses", label: "Courses" },
    ...(canBlog ? [{ href: "/manage/blog", label: "Blog" }] : []),
    { href: "/courses", label: "Public catalogue" },
  ];

  if (role === "admin") {
    return [
      { href: "/admin", label: "Dashboard", exact: true },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/audit", label: "Audit log" },
      { label: "Content", children: content },
      { href: "/admin/settings", label: "Settings" },
    ];
  }

  // instructor / content-manager — manage surface only
  return [
    { href: "/manage", label: "Overview", exact: true },
    { label: "Content", children: content },
  ];
}
