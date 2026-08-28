import type { Metadata } from "next";
import Link from "next/link";
import { CourseForm } from "@/components/manage/CourseForm";

export const metadata: Metadata = { title: "New course" };

export default function NewCoursePage() {
  return (
    <div className="max-w-xl">
      <Link href="/manage/courses" className="text-[13px] text-ink-500 hover:text-ink-900">
        ← Courses
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        New course
      </h1>
      <p className="mt-1 mb-6 text-[15px] text-ink-500">
        You&apos;ll add lessons after it&apos;s created.
      </p>
      <CourseForm mode="create" />
    </div>
  );
}
