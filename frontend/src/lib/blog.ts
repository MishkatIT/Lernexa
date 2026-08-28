import "server-only";

import { strapiFetch, StrapiError } from "./strapi";
import { getToken } from "./session";

export type PostListItem = {
  documentId: string;
  title: string;
  slug: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  author: { fullName: string | null } | null;
};

export type Post = PostListItem & { body: string | null };

export async function listPublishedPosts(): Promise<PostListItem[]> {
  const res = await strapiFetch<{ data: PostListItem[] }>("/api/blog-posts", {
    cache: "no-store",
  });
  return res.data;
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

/** Manager list — includes drafts (status=draft returns every entry's draft). */
export async function listManagedPosts(): Promise<PostListItem[]> {
  const token = await getToken();
  const [pub, draft] = await Promise.all([
    strapiFetch<{ data: PostListItem[] }>("/api/blog-posts", { token }),
    strapiFetch<{ data: PostListItem[] }>("/api/blog-posts?status=draft", { token }),
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
