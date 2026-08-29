import type { Metadata } from "next";
import { listPublishedPosts, countByCategory } from "@/lib/blog";
import { getCurrentUser } from "@/lib/session";
import { CATEGORIES, categoryLabel, isCategorySlug } from "@/lib/blog-categories";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { BlogMasthead } from "@/components/blog/BlogMasthead";
import { CategoryBar } from "@/components/blog/CategoryBar";
import { FeaturedArticle } from "@/components/blog/FeaturedArticle";
import { ArticleRow } from "@/components/blog/ArticleRow";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Notes on building a learning platform — engineering, product, and how people learn to build software.",
};

const CAN_WRITE = new Set(["admin", "content-manager"]);

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() || undefined;
  const category = isCategorySlug(sp.category) ? sp.category : undefined;
  const filtered = Boolean(q || category);

  const [{ items, pageCount, total }, user, catCounts] = await Promise.all([
    listPublishedPosts(page, { q, category }),
    getCurrentUser(),
    // Counts only matter on the unfiltered first view; keep the bar cheap otherwise.
    page === 1 && !filtered
      ? Promise.all(
          CATEGORIES.map(async (c) => [c.slug, await countByCategory(c.slug)] as const),
        ).then((pairs) => Object.fromEntries(pairs))
      : Promise.resolve<Record<string, number>>({}),
  ]);

  const canWrite = CAN_WRITE.has(user?.role?.type ?? "");
  // The lead story only makes sense on an unfiltered first page.
  const showFeatured = page === 1 && !filtered && items.length > 0;
  const featured = showFeatured ? items[0] : null;
  const feed = showFeatured ? items.slice(1) : items;

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <BlogMasthead canWrite={canWrite} />

      <div className="mt-6">
        <CategoryBar active={category ?? null} counts={catCounts} />
      </div>

      {filtered ? (
        <p className="mt-6 text-small text-ink-500">
          {total} {total === 1 ? "article" : "articles"}
          {category ? ` in ${categoryLabel(category)}` : ""}
          {q ? ` matching “${q}”` : ""}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title={
              filtered
                ? "Nothing matches"
                : page > 1
                  ? "Nothing on this page"
                  : "No articles yet"
            }
            description={
              filtered
                ? "Try another topic or clear the search."
                : page > 1
                  ? "Head back to the first page."
                  : "Published posts will appear here as they're written."
            }
            action={
              filtered || page > 1
                ? { label: "Back to all articles", href: "/blog" }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          {featured ? (
            <div className="mt-10 border-b border-ink-200 pb-12">
              <FeaturedArticle post={featured} />
            </div>
          ) : null}

          <div className="mt-2 divide-y divide-ink-200">
            {feed.map((post) => (
              <ArticleRow key={post.documentId} post={post} />
            ))}
          </div>

          <Pagination
            className="mt-10"
            page={page}
            pageCount={pageCount}
            makeHref={makeHref}
          />
        </>
      )}
    </Container>
  );
}
