import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { listPlatformUsers } from "@/lib/admin";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsersTable } from "@/components/admin/UsersTable";
import { UsersFilters } from "@/components/admin/UsersFilters";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  const page = Math.max(1, Number(sp.page) || 1);

  const { users, pageCount, total } = await listPlatformUsers({
    page,
    q: sp.q,
    role: sp.role,
    status: sp.status,
  });

  const hasFilters = Boolean(sp.q || sp.role || sp.status);
  const qp = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: sp.q, role: sp.role, status: sp.status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader
        as="h1"
        eyebrow="Admin"
        title="Users"
        description={`${total} account${total === 1 ? "" : "s"}${
          hasFilters ? " matching your filters" : ""
        }.`}
      />

      <UsersFilters />

      <div className="mt-6">
        {users.length === 0 ? (
          <EmptyState
            title="No users match"
            description="Try a broader search or clear the filters."
          />
        ) : (
          <UsersTable users={users} currentUserId={me?.id ?? -1} />
        )}
      </div>

      {pageCount > 1 ? (
        <div className="mt-5 flex items-center gap-4 text-small">
          {page > 1 ? (
            <Link
              href={qp({ page: String(page - 1) })}
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
