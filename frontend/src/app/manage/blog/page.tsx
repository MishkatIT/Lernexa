import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { listManagedPosts } from "@/lib/blog";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { ManagedPostList } from "@/components/manage/ManagedPostList";

export const metadata: Metadata = { title: "Blog" };

export default async function ManageBlogPage() {
  await requireRole("admin", "content-manager");
  const posts = await listManagedPosts();
  const published = posts.filter((p) => p.publishedAt).length;

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        as="h1"
        eyebrow="Content"
        title="Blog"
        description={
          posts.length === 0
            ? "No posts yet."
            : `${posts.length} post${posts.length === 1 ? "" : "s"} · ${published} published`
        }
        action={
          <ButtonLink href="/manage/blog/new" size="sm">
            New post
          </ButtonLink>
        }
      />

      {posts.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing published yet"
            description="Write your first post. It's created as a draft — publish it when it's ready."
            action={{ label: "New post", href: "/manage/blog/new" }}
          />
        </div>
      ) : (
        <ManagedPostList
          posts={posts.map((p) => ({
            documentId: p.documentId,
            title: p.title,
            publishedAt: p.publishedAt,
          }))}
        />
      )}
    </div>
  );
}
