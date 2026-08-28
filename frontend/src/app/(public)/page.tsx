import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { dashboardPathFor, ROLE_LABELS, type RoleType } from "@/lib/roles";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="max-w-xl">
      <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink-900">
        Progress, not catalogue.
      </h1>
      <p className="mt-3 text-[15px] text-ink-700">
        Lernexa is a learning management system that leads with where you are, not
        with a grid of courses. Sign in to pick up where you left off.
      </p>

      <div className="mt-6 flex items-center gap-3">
        {user ? (
          <Link
            href={dashboardPathFor(user.role?.type)}
            className="rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
          >
            Go to your dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/register"
              className="rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="rounded-sm border border-ink-200 px-4 py-2 text-[15px] font-medium text-ink-900 hover:bg-ink-100"
            >
              Log in
            </Link>
          </>
        )}
      </div>

      {user ? (
        <p className="mt-4 text-[13px] text-ink-500">
          Signed in as {user.fullName ?? user.username} —{" "}
          {ROLE_LABELS[user.role?.type as RoleType] ?? "no role"}.
        </p>
      ) : null}
    </div>
  );
}
