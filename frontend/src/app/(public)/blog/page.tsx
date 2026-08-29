import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts } from "@/lib/blog";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";

export const metadata: Metadata = { title: "Blog" };

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() || undefined;
  const { items: posts, pageCount } = await listPublishedPosts(page, q);

  return (
    <Container size="content" className="py-10 sm:py-14">
      <SectionHeader
        as="h1"
        eyebrow="Writing"
        title="Blog"
        description="Notes on learning, progress, and how Lernexa is built."
      />

      <div className="mt-6 max-w-sm">
        <SearchField placeholder="Search posts by title" label="Search the blog" />
      </div>

      {posts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={
              q
                ? "No posts match your search"
                : page > 1
                  ? "Nothing on this page"
                  : "Nothing published yet"
            }
            description={
              q
                ? "Try a different term, or clear the search."
                : page > 1
                  ? "Head back to the first page."
                  : "Posts will appear here as they're written."
            }
            action={
              q
                ? { label: "Clear search", href: "/blog" }
                : page > 1
                  ? { label: "First page", href: "/blog" }
                  : undefined
            }
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
          makeHref={(p) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (p > 1) params.set("page", String(p));
            const s = params.toString();
            return s ? `/blog?${s}` : "/blog";
          }}
        />
        </>
      )}
    </Container>
  );
}
