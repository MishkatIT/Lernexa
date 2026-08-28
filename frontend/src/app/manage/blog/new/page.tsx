import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { PostForm } from "@/components/manage/PostForm";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireRole("admin", "content-manager");
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">New post</h1>
      <p className="mt-1 mb-6 text-[15px] text-ink-500">
        Created as a draft. Publish it from the blog list.
      </p>
      <PostForm mode="create" />
    </div>
  );
}
