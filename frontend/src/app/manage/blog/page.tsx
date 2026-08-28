import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { listManagedPosts } from "@/lib/blog";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PostRowActions } from "@/components/manage/PostRowActions";

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
        <ul className="mt-6 flex flex-col gap-2">
          {posts.map((p) => (
            <li key={p.documentId}>
              <Card className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Link
                    href={`/manage/blog/${p.documentId}`}
                    className="truncate text-body font-medium text-ink-900 hover:underline"
                  >
                    {p.title}
                  </Link>
                  <Badge tone={p.publishedAt ? "success" : "neutral"}>
                    {p.publishedAt ? "Published" : "Draft"}
                  </Badge>
                </span>
                <PostRowActions
                  documentId={p.documentId}
                  title={p.title}
                  published={Boolean(p.publishedAt)}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
