import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getManagedPost } from "@/lib/blog";
import { Badge } from "@/components/ui/Badge";
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
    <div className="mx-auto max-w-2xl">
      <Link
        href="/manage/blog"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Blog
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-display text-ink-900">{post.title}</h1>
        <Badge tone={post.publishedAt ? "success" : "neutral"}>
          {post.publishedAt ? "Published" : "Draft"}
        </Badge>
      </div>
      <p className="mt-1 mb-8 text-small text-ink-500">
        Publish and unpublish from the blog list.
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
