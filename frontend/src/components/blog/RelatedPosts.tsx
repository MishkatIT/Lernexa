import Link from "next/link";
import type { PostListItem } from "@/lib/blog";
import { categoryLabel } from "@/lib/blog-categories";

/**
 * "You might also like" — a minimal three-up at the foot of an article. No
 * images, no card chrome; category kicker + title + meta, editorial and quiet.
 */
export function RelatedPosts({ posts }: { posts: PostListItem[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t border-ink-200 pt-10">
      <h2 className="text-h3 uppercase tracking-[0.1em] text-ink-500">
        You might also like
      </h2>

      <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => {
          const cat = categoryLabel(p.category);
          return (
            <article key={p.documentId}>
              {cat ? (
                <p className="text-small font-medium uppercase tracking-[0.08em] text-ink-500">
                  {cat}
                </p>
              ) : null}
              <h3 className="mt-1">
                <Link
                  href={`/blog/${p.slug ?? p.documentId}`}
                  className="text-h2 text-ink-900 transition-colors hover:text-accent-600"
                >
                  {p.title}
                </Link>
              </h3>
              <p className="mt-2 text-small text-ink-500">
                {p.author?.fullName ?? "Lernexa"} · {p.readingMinutes} min read
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
