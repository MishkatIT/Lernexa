import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { ROLE_LABELS, type RoleType } from "@/lib/roles";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("instructor", "content-manager", "admin");

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-200 bg-paper-raised px-4 py-6 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 text-ink-900">
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="block h-1.5 w-6 rounded-sm bg-ink-900" />
            <span className="block h-1.5 w-6 rounded-sm bg-ink-900" />
            <span className="block h-1.5 w-6 rounded-sm border border-ink-900" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Lernexa</span>
        </Link>
        <nav className="flex flex-col gap-1 text-[14px]">
          <Link href="/manage" className="rounded-sm px-2 py-1.5 text-ink-700 hover:bg-ink-100">
            Overview
          </Link>
          <Link
            href="/manage/courses"
            className="rounded-sm px-2 py-1.5 text-ink-700 hover:bg-ink-100"
          >
            Courses
          </Link>
          <Link href="/courses" className="rounded-sm px-2 py-1.5 text-ink-700 hover:bg-ink-100">
            Public catalogue
          </Link>
        </nav>
        <div className="mt-auto pt-6 text-[13px] text-ink-500">
          <p className="mb-2">
            {user.fullName ?? user.username}
            <br />
            {ROLE_LABELS[user.role?.type as RoleType]}
          </p>
          <LogoutButton />
        </div>
      </aside>
      <div className="flex-1 px-6 py-8 lg:px-10">{children}</div>
    </div>
  );
}
