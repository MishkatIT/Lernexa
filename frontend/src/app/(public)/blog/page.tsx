import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts } from "@/lib/blog";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";

export const metadata: Metadata = { title: "Blog" };

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items: posts, pageCount } = await listPublishedPosts(page);

  return (
    <Container size="content" className="py-10 sm:py-14">
      <SectionHeader
        as="h1"
        eyebrow="Writing"
        title="Blog"
        description="Notes on learning, progress, and how Lernexa is built."
      />

      {posts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={page > 1 ? "Nothing on this page" : "Nothing published yet"}
            description={
              page > 1
                ? "Head back to the first page."
                : "Posts will appear here as they're written."
            }
            action={page > 1 ? { label: "First page", href: "/blog" } : undefined}
          />
        </div>
      ) : (
        <>
        <ul className="mt-8 divide-y divide-ink-200 border-y border-ink-200">
          {posts.map((p) => (
            <li key={p.documentId}>
              <Link
                href={`/blog/${p.slug ?? p.documentId}`}
                className="group flex flex-col gap-1.5 py-6 transition-colors"
              >
                <p className="text-small text-ink-500">
                  {p.author?.fullName ? `${p.author.fullName} · ` : ""}
                  {p.publishedAt
                    ? new Date(p.publishedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : ""}
                </p>
                <h2 className="text-h2 text-ink-900 transition-colors group-hover:text-accent-600">
                  {p.title}
                </h2>
              </Link>
            </li>
          ))}
        </ul>
        <Pagination
          className="mt-8"
          page={page}
          pageCount={pageCount}
          makeHref={(p) => (p === 1 ? "/blog" : `/blog?page=${p}`)}
        />
        </>
      )}
    </Container>
  );
}
