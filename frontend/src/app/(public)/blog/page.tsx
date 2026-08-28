import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog" };

export default async function BlogListPage() {
  const posts = await listPublishedPosts();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Blog</h1>
      {posts.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-500">No posts yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5">
          {posts.map((p) => (
            <li key={p.documentId}>
              <Link
                href={`/blog/${p.slug ?? p.documentId}`}
                className="block rounded-sm border border-ink-200 bg-paper-raised p-5 hover:border-ink-500"
              >
                <h2 className="text-[17px] font-semibold text-ink-900">{p.title}</h2>
                <p className="mt-1 text-[13px] text-ink-500">
                  {p.author?.fullName ? `${p.author.fullName} · ` : ""}
                  {p.publishedAt
                    ? new Date(p.publishedAt).toLocaleDateString()
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
