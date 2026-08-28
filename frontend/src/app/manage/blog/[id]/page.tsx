import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getManagedPost } from "@/lib/blog";
import { PostForm } from "@/components/manage/PostForm";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "content-manager");
  const { id } = await params;
  const post = await getManagedPost(id);
  if (!post) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/manage/blog" className="text-[13px] text-ink-500 hover:text-ink-900">
        ← Blog
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        {post.title}
      </h1>
      <p className="mt-1 mb-6 text-[13px] text-ink-500">
        {post.publishedAt ? "Published" : "Draft"} — publish/unpublish from the list.
      </p>
      <PostForm
        mode="edit"
        documentId={post.documentId}
        initial={{
          title: post.title,
          body: post.body ?? "",
          coverImageUrl: post.coverImageUrl ?? "",
        }}
      />
    </div>
  );
}
