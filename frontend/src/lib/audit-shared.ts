/**
 * Types and pure helpers for the audit log — safe to import from client
 * components. The data-fetching lives in `audit.ts` (server-only).
 */

export type AuditCategory = "security" | "content" | "account";

export type AuditEntry = {
  id: number;
  action: string;
  category: AuditCategory;
  actorId: number | null;
  actorLabel: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
};

export type AuditQuery = {
  page?: number;
  action?: string;
  category?: string;
  actorId?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
};

export const AUDIT_PAGE_SIZE = 25;

/** Every action the backend can emit, for the filter dropdown. */
export const AUDIT_ACTIONS: {
  value: string;
  label: string;
  category: AuditCategory;
}[] = [
  { value: "user.registered", label: "Registered", category: "account" },
  { value: "account.password_changed", label: "Password changed", category: "account" },
  { value: "user.role_changed", label: "Role changed", category: "security" },
  { value: "user.blocked", label: "User blocked", category: "security" },
  { value: "user.unblocked", label: "User unblocked", category: "security" },
  { value: "settings.updated", label: "Settings updated", category: "security" },
  { value: "course.created", label: "Course created", category: "content" },
  { value: "course.deleted", label: "Course deleted", category: "content" },
  { value: "blog.published", label: "Post published", category: "content" },
  { value: "blog.unpublished", label: "Post unpublished", category: "content" },
  { value: "blog.deleted", label: "Post deleted", category: "content" },
];

const ACTION_LABEL = new Map(AUDIT_ACTIONS.map((a) => [a.value, a.label]));

export function actionLabel(action: string): string {
  return (
    ACTION_LABEL.get(action) ??
    action
      .split(".")
      .pop()!
      .replace(/_/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}
