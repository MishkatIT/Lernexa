import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import { dashboardPathFor } from "@/lib/roles";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-ink-200 bg-paper-raised">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-ink-900">
            <span className="flex flex-col gap-[3px]" aria-hidden>
              <span className="block h-1.5 w-6 rounded-sm bg-ink-900" />
              <span className="block h-1.5 w-6 rounded-sm bg-ink-900" />
              <span className="block h-1.5 w-6 rounded-sm border border-ink-900" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Lernexa</span>
          </Link>
          <nav className="flex items-center gap-4 text-[14px]">
            <Link href="/courses" className="text-ink-700 hover:text-ink-900">
              Courses
            </Link>
            <Link href="/blog" className="text-ink-700 hover:text-ink-900">
              Blog
            </Link>
            {user ? (
              <Link
                href={dashboardPathFor(user.role?.type)}
                className="rounded-sm bg-accent-600 px-3 py-1.5 font-medium text-paper-raised hover:bg-accent-500"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-ink-700 hover:text-ink-900">
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-sm bg-accent-600 px-3 py-1.5 font-medium text-paper-raised hover:bg-accent-500"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
