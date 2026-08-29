import Link from "next/link";
import type { PostListItem } from "@/lib/blog";
import { categoryLabel } from "@/lib/blog-categories";
import { ArticleByline } from "./ArticleByline";

/**
 * One row in the article feed. The title is the dominant element; the thumbnail
 * is a fixed, secondary block on the right that drops away on small screens.
 */
export function ArticleRow({ post }: { post: PostListItem }) {
  const href = `/blog/${post.slug ?? post.documentId}`;
  const cat = categoryLabel(post.category);

  return (
    <article className="flex items-start gap-6 py-8">
      <div className="min-w-0 flex-1">
        {cat ? (
          <p className="text-small font-medium uppercase tracking-[0.08em] text-ink-500">
            {cat}
          </p>
        ) : null}

        <h3 className="mt-1.5">
          <Link
            href={href}
            className="text-h1 font-semibold tracking-[-0.015em] text-ink-900 transition-colors hover:text-accent-600"
          >
            {post.title}
          </Link>
        </h3>

        {post.excerpt ? (
          <p className="mt-2 line-clamp-2 text-body text-ink-700">
            {post.excerpt}
          </p>
        ) : null}

        <div className="mt-4">
          <ArticleByline
            authorName={post.author?.fullName ?? null}
            authorAvatarUrl={post.author?.avatarUrl}
            date={post.publishedAt ?? post.createdAt}
            readingMinutes={post.readingMinutes}
          />
        </div>
      </div>

      {post.coverImageUrl ? (
        <Link
          href={href}
          aria-hidden
          tabIndex={-1}
          className="hidden shrink-0 sm:block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary host; no next/image pipeline */}
          <img
            src={post.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-28 w-40 rounded-md border border-ink-200 object-cover md:h-32 md:w-52"
          />
        </Link>
      ) : null}
    </article>
  );
}
