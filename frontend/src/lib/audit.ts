import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";
import { AUDIT_PAGE_SIZE, type AuditEntry, type AuditQuery } from "./audit-shared";

export {
  AUDIT_PAGE_SIZE,
  AUDIT_ACTIONS,
  actionLabel,
  type AuditEntry,
  type AuditCategory,
  type AuditQuery,
} from "./audit-shared";

export async function listAuditLog(params: AuditQuery): Promise<{
  entries: AuditEntry[];
  page: number;
  pageCount: number;
  total: number;
}> {
  const token = await getToken();
  const qs = new URLSearchParams({ pageSize: String(AUDIT_PAGE_SIZE) });
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  if (params.action) qs.set("action", params.action);
  if (params.category) qs.set("category", params.category);
  if (params.actorId) qs.set("actorId", params.actorId);
  if (params.q) qs.set("q", params.q);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.sort) qs.set("sort", params.sort);

  const res = await strapiFetch<{
    data: AuditEntry[];
    meta: { pagination: { page: number; pageCount: number; total: number } };
  }>(`/api/platform/audit?${qs}`, { token });

  return {
    entries: res.data,
    page: res.meta.pagination.page,
    pageCount: res.meta.pagination.pageCount,
    total: res.meta.pagination.total,
  };
}

/** The newest N entries, for the admin dashboard activity strip. */
export async function getRecentActivity(limit = 5): Promise<AuditEntry[]> {
  try {
    const { entries } = await listAuditLog({});
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}
