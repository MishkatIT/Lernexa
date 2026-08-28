import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { PostForm } from "@/components/manage/PostForm";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireRole("admin", "content-manager");
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/manage/blog"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Blog
      </Link>
      <h1 className="mt-3 text-display text-ink-900">New post</h1>
      <p className="mt-1 mb-8 text-body text-ink-500">
        Created as a draft. Publish it from the blog list.
      </p>
      <PostForm mode="create" />
    </div>
  );
}
