import "server-only";

import { strapiFetch, StrapiError } from "./strapi";
import { getToken } from "./session";

export type PostAuthor = {
  fullName: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type PostListItem = {
  documentId: string;
  title: string;
  slug: string | null;
  subtitle: string | null;
  category: string | null;
  excerpt: string;
  readingMinutes: number;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  author: PostAuthor | null;
};

export type Post = {
  documentId: string;
  title: string;
  slug: string | null;
  subtitle: string | null;
  category: string | null;
  body: string | null;
  readingMinutes: number;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  author: PostAuthor | null;
};

export type PagedPosts = {
  items: PostListItem[];
  page: number;
  pageCount: number;
  total: number;
};

type ListOptions = { q?: string; category?: string; pageSize?: number };

const EMPTY_PAGINATION = { page: 1, pageCount: 1, total: 0 };

/**
 * Published-post reads are public and identical for everyone, so they're cached
 * and shared across requests — this is what makes switching topics on the blog
 * index feel instant on a revisit. Blog mutations call
 * `revalidateTag("blog-posts")` (actions/blog.ts) so editors never see stale
 * data; the 5-minute window just bounds drift if that ever misfires.
 */
const PUBLIC_POSTS = {
  cache: "force-cache" as const,
  next: { revalidate: 300, tags: ["blog-posts"] },
};

export async function listPublishedPosts(
  page = 1,
  { q, category, pageSize = 12 }: ListOptions = {},
): Promise<PagedPosts> {
  const qs = new URLSearchParams({
    "pagination[page]": String(Math.max(1, page)),
    "pagination[pageSize]": String(pageSize),
  });
  if (q?.trim()) qs.set("q", q.trim());
  if (category?.trim()) qs.set("category", category.trim());

  const res = await strapiFetch<{
    data: PostListItem[];
    meta?: { pagination?: { page: number; pageCount: number; total: number } };
  }>(`/api/blog-posts?${qs}`, PUBLIC_POSTS);

  const p = res.meta?.pagination ?? EMPTY_PAGINATION;
  return { items: res.data, page: p.page, pageCount: p.pageCount, total: p.total };
}

/** Total published-post count per category, for the topic bar. One light query
 *  (no bodies, pageSize 1) per — the loop is small and fixed. */
export async function countByCategory(
  category: string,
): Promise<number> {
  try {
    const res = await strapiFetch<{
      meta?: { pagination?: { total: number } };
    }>(
      `/api/blog-posts?category=${encodeURIComponent(category)}&pagination[pageSize]=1`,
      PUBLIC_POSTS,
    );
    return res.meta?.pagination?.total ?? 0;
  } catch {
    return 0;
  }
}

export async function getPublishedPost(slug: string): Promise<Post | null> {
  const res = await strapiFetch<{ data: PostListItem[] }>(
    `/api/blog-posts?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`,
    { cache: "no-store" },
  );
  const stub = res.data[0];
  if (!stub) return null;
  try {
    const full = await strapiFetch<{ data: Post }>(
      `/api/blog-posts/${stub.documentId}`,
    );
    return full.data;
  } catch {
    return null;
  }
}

/** "You might also like" — same category, newest first, current post removed.
 *  Falls back to the latest posts so the section is never empty on a thin
 *  category. */
export async function getRelatedPosts(
  category: string | null,
  excludeSlug: string | null,
  limit = 3,
): Promise<PostListItem[]> {
  const pick = (items: PostListItem[]) =>
    items.filter((p) => p.slug !== excludeSlug).slice(0, limit);

  if (category) {
    const { items } = await listPublishedPosts(1, {
      category,
      pageSize: limit + 1,
    });
    const related = pick(items);
    if (related.length >= limit) return related;
  }

  const { items } = await listPublishedPosts(1, { pageSize: limit + 4 });
  return pick(items);
}

/** Manager list — includes drafts (status=draft returns every entry's draft).
 *  pageSize 100 is Strapi's maxLimit; past ~100 posts this needs real paging. */
export async function listManagedPosts(): Promise<PostListItem[]> {
  const token = await getToken();
  const size = "pagination[pageSize]=100&sort=createdAt:desc";
  const [pub, draft] = await Promise.all([
    strapiFetch<{ data: PostListItem[] }>(`/api/blog-posts?${size}`, { token }),
    strapiFetch<{ data: PostListItem[] }>(
      `/api/blog-posts?status=draft&${size}`,
      { token },
    ),
  ]);
  const map = new Map<string, PostListItem>();
  for (const p of draft.data) map.set(p.documentId, p);
  for (const p of pub.data) map.set(p.documentId, p); // published wins (has publishedAt)
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export async function getManagedPost(documentId: string): Promise<Post | null> {
  const token = await getToken();
  try {
    const res = await strapiFetch<{ data: Post }>(
      `/api/blog-posts/${documentId}`,
      { token },
    );
    return res.data;
  } catch (err) {
    if (err instanceof StrapiError) return null;
    throw err;
  }
}
