import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Manage" };

export default async function ManageOverviewPage() {
  const user = await getCurrentUser();
  const isInstructor = user?.role?.type === "instructor";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Manage</h1>
      <p className="mt-1 text-[15px] text-ink-500">
        {isInstructor
          ? "Your courses and their lessons."
          : "All courses, lessons and quizzes across the platform."}
      </p>
      <div className="mt-6">
        <Link
          href="/manage/courses"
          className="rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
        >
          Go to courses
        </Link>
      </div>
    </div>
  );
}
