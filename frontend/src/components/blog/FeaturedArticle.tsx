import Link from "next/link";
import type { PostListItem } from "@/lib/blog";
import { categoryLabel } from "@/lib/blog-categories";
import { ArticleByline } from "./ArticleByline";

/**
 * The lead story. Editorial two-column on desktop (text, then image), stacked
 * image-first on mobile. Larger type than a feed row; still no card chrome.
 */
export function FeaturedArticle({ post }: { post: PostListItem }) {
  const href = `/blog/${post.slug ?? post.documentId}`;
  const cat = categoryLabel(post.category);

  return (
    <article className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-10">
      {post.coverImageUrl ? (
        <Link href={href} className="order-1 block lg:order-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary host; no next/image pipeline */}
          <img
            src={post.coverImageUrl}
            alt=""
            className="aspect-[16/10] w-full rounded-lg border border-ink-200 object-cover"
          />
        </Link>
      ) : null}

      <div className="order-2 lg:order-1">
        <p className="text-small font-medium uppercase tracking-[0.1em] text-accent-600">
          {cat ?? "Featured"}
        </p>
        <h2 className="mt-2">
          <Link
            href={href}
            className="text-display font-semibold tracking-[-0.02em] text-ink-900 transition-colors hover:text-accent-600 sm:text-[2.4rem] sm:leading-[1.15]"
          >
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? (
          <p className="mt-3 max-w-prose text-reading text-ink-700">
            {post.excerpt}
          </p>
        ) : null}
        <div className="mt-5">
          <ArticleByline
            authorName={post.author?.fullName ?? null}
            authorAvatarUrl={post.author?.avatarUrl}
            date={post.publishedAt ?? post.createdAt}
            readingMinutes={post.readingMinutes}
            size="md"
          />
        </div>
      </div>
    </article>
  );
}
