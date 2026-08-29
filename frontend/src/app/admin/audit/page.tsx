import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import {
  listAuditLog,
  AUDIT_PAGE_SIZE,
  type AuditQuery,
} from "@/lib/audit";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuditTable } from "@/components/admin/AuditTable";
import { AuditFilters } from "@/components/admin/AuditFilters";

export const metadata: Metadata = { title: "Audit log" };

type SP = Promise<
  { page?: string } & Omit<AuditQuery, "page">
>;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const { entries, pageCount, total } = await listAuditLog({
    page,
    action: sp.action,
    category: sp.category,
    q: sp.q,
    sort: sp.sort,
  });

  const hasFilters = Boolean(sp.q || sp.action || sp.category || sp.sort === "oldest");
  const qp = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      q: sp.q,
      action: sp.action,
      category: sp.category,
      sort: sp.sort,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `?${s}` : "?";
  };

  const first = total === 0 ? 0 : (page - 1) * AUDIT_PAGE_SIZE + 1;
  const last = Math.min(page * AUDIT_PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader
        as="h1"
        eyebrow="Admin"
        title="Audit & activity log"
        description="Append-only history of security-sensitive and structural changes. Entries are written by the backend and cannot be edited or deleted. Learning activity — enrolments, completions, quiz attempts — is analytics and lives on the dashboards, not here."
      />

      <AuditFilters />

      <p className="mt-5 text-small text-ink-500">
        {total === 0
          ? "No entries"
          : `Showing ${first}–${last} of ${total}`}
      </p>

      <div className="mt-3">
        {entries.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No entries match" : "Nothing logged yet"}
            description={
              hasFilters
                ? "Try a broader filter or clear the search."
                : "Security and content changes will appear here as they happen."
            }
          />
        ) : (
          <AuditTable entries={entries} />
        )}
      </div>

      {pageCount > 1 ? (
        <div className="mt-5 flex items-center gap-4 text-small">
          {page > 1 ? (
            <Link
              href={qp({ page: page - 1 === 1 ? undefined : String(page - 1) })}
              className="text-accent-600 hover:underline"
            >
              ← Prev
            </Link>
          ) : (
            <span className="text-ink-500/60">← Prev</span>
          )}
          <span className="text-ink-500">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={qp({ page: String(page + 1) })}
              className="text-accent-600 hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span className="text-ink-500/60">Next →</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
