export type RoleType = "admin" | "content-manager" | "instructor" | "student";

export const ROLE_LABELS: Record<RoleType, string> = {
  admin: "Admin",
  "content-manager": "Content Manager",
  instructor: "Instructor",
  student: "Student",
};

/** Where a role lands after login. Instructors and content managers share the
 *  manage surface (same shape, different data scope — docs/ARCHITECTURE.md). */
export function dashboardPathFor(role: string | null | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "content-manager":
    case "instructor":
      return "/manage";
    case "student":
      return "/dashboard";
    default:
      return "/";
  }
}
