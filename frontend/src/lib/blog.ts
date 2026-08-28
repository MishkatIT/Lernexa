import "server-only";

import { strapiFetch, StrapiError } from "./strapi";
import { getToken } from "./session";

export type PostListItem = {
  documentId: string;
  title: string;
  slug: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  author: { fullName: string | null } | null;
};

export type Post = PostListItem & { body: string | null };

export type PagedPosts = {
  items: PostListItem[];
  page: number;
  pageCount: number;
  total: number;
};

export async function listPublishedPosts(
  page = 1,
  pageSize = 10,
): Promise<PagedPosts> {
  const qs = new URLSearchParams({
    "pagination[page]": String(Math.max(1, page)),
    "pagination[pageSize]": String(pageSize),
  });
  const res = await strapiFetch<{
    data: PostListItem[];
    meta?: { pagination?: { page: number; pageCount: number; total: number } };
  }>(`/api/blog-posts?${qs}`, { cache: "no-store" });
  const p = res.meta?.pagination ?? { page: 1, pageCount: 1, total: 0 };
  return { items: res.data, page: p.page, pageCount: p.pageCount, total: p.total };
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
