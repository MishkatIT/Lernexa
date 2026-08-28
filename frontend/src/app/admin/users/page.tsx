import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { listPlatformUsers } from "@/lib/admin";
import { UsersTable } from "@/components/admin/UsersTable";

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

  const qp = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: sp.q, role: sp.role, status: sp.status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `?${next.toString()}`;
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Users</h1>
      <p className="mt-1 text-[15px] text-ink-500">{total} total.</p>

      <form className="mt-5 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or email"
          className="h-9 w-56 rounded-sm border border-ink-200 bg-paper-raised px-3 text-[14px] outline-none focus:ring-2 focus:ring-accent-500"
        />
        <select
          name="role"
          defaultValue={sp.role ?? ""}
          className="h-9 rounded-sm border border-ink-200 bg-paper-raised px-2 text-[14px]"
        >
          <option value="">Any role</option>
          <option value="admin">Admin</option>
          <option value="content-manager">Content Manager</option>
          <option value="instructor">Instructor</option>
          <option value="student">Student</option>
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-9 rounded-sm border border-ink-200 bg-paper-raised px-2 text-[14px]"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
        <button
          type="submit"
          className="h-9 rounded-sm border border-ink-200 px-3 text-[14px] font-medium hover:bg-ink-100"
        >
          Filter
        </button>
      </form>

      <div className="mt-5">
        <UsersTable users={users} currentUserId={me?.id ?? -1} />
      </div>

      {pageCount > 1 ? (
        <div className="mt-4 flex items-center gap-3 text-[14px]">
          {page > 1 ? (
            <Link href={qp({ page: String(page - 1) })} className="text-accent-600 hover:underline">
              ← Prev
            </Link>
          ) : null}
          <span className="text-ink-500">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={qp({ page: String(page + 1) })} className="text-accent-600 hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
