import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/guards";
import { listManagedPosts } from "@/lib/blog";
import { PostRowActions } from "@/components/manage/PostRowActions";

export const metadata: Metadata = { title: "Blog" };

export default async function ManageBlogPage() {
  await requireRole("admin", "content-manager");
  const posts = await listManagedPosts();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Blog</h1>
        <Link
          href="/manage/blog/new"
          className="rounded-sm bg-accent-600 px-4 py-2 text-[15px] font-medium text-paper-raised hover:bg-accent-500"
        >
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-500">No posts yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {posts.map((p) => (
            <li
              key={p.documentId}
              className="flex items-center justify-between rounded-sm border border-ink-200 bg-paper-raised px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <Link
                  href={`/manage/blog/${p.documentId}`}
                  className="text-[15px] font-medium text-ink-900 hover:underline"
                >
                  {p.title}
                </Link>
                <span
                  className={`rounded-sm border px-2 py-0.5 text-[12px] ${
                    p.publishedAt
                      ? "border-success text-success"
                      : "border-ink-200 text-ink-500"
                  }`}
                >
                  {p.publishedAt ? "Published" : "Draft"}
                </span>
              </span>
              <PostRowActions
                documentId={p.documentId}
                title={p.title}
                published={Boolean(p.publishedAt)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
