import type { Metadata } from "next";
import Link from "next/link";
import { CourseForm } from "@/components/manage/CourseForm";

export const metadata: Metadata = { title: "New course" };

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/manage/courses"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Courses
      </Link>
      <h1 className="mt-3 text-display text-ink-900">New course</h1>
      <p className="mt-1 mb-8 text-body text-ink-500">
        You&apos;ll add lessons after it&apos;s created.
      </p>
      <CourseForm mode="create" />
    </div>
  );
}
