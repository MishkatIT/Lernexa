import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPost, getRelatedPosts } from "@/lib/blog";
import { categoryLabel } from "@/lib/blog-categories";
import { Container } from "@/components/ui/Container";
import { ArticleByline } from "@/components/blog/ArticleByline";
import { ArticleActions } from "@/components/blog/ArticleActions";
import { ArticleBody } from "@/components/blog/ArticleBody";
import { AuthorCard } from "@/components/blog/AuthorCard";
import { RelatedPosts } from "@/components/blog/RelatedPosts";

// Published articles are public and identical for everyone. The render path
// touches no request-time APIs, so force it static: it prerenders per slug and
// serves from the edge. A publish/edit busts it immediately via the
// `blog-posts` tag (actions/blog.ts); `revalidate` is the time-based backstop.
export const dynamic = "force-static";
export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  if (!post) return { title: "Post" };
  const description =
    post.subtitle?.trim() ||
    (post.body ?? "").replace(/\s+/g, " ").trim().slice(0, 155);
  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(post.category, post.slug, 3);
  const cat = categoryLabel(post.category);

  return (
    <Container size="reading" className="py-10 sm:py-14">
      <Link
        href="/blog"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← All articles
      </Link>

      <article className="mt-6">
        <header>
          {cat ? (
            <Link
              href={`/blog?category=${post.category}`}
              className="text-small font-medium uppercase tracking-[0.1em] text-accent-600 hover:underline"
            >
              {cat}
            </Link>
          ) : null}

          <h1 className="mt-2 text-[2rem] font-semibold leading-[1.2] tracking-[-0.02em] text-ink-900 sm:text-[2.5rem] sm:leading-[1.12]">
            {post.title}
          </h1>

          {post.subtitle?.trim() ? (
            <p className="mt-3 text-h2 font-normal leading-snug text-ink-500">
              {post.subtitle}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-ink-200 py-3">
            <ArticleByline
              authorName={post.author?.fullName ?? null}
              authorAvatarUrl={post.author?.avatarUrl}
              date={post.publishedAt}
              size="md"
            />
            <ArticleActions
              slug={post.slug ?? post.documentId}
              title={post.title}
              readingMinutes={post.readingMinutes}
            />
          </div>
        </header>

        {post.coverImageUrl ? (
          <figure className="mt-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary host; no next/image pipeline */}
            <img
              src={post.coverImageUrl}
              alt=""
              className="w-full rounded-lg border border-ink-200 object-cover"
            />
          </figure>
        ) : null}

        <div className="mt-10">
          <ArticleBody markdown={post.body ?? ""} />
        </div>

        <div className="mt-14">
          <AuthorCard author={post.author} />
        </div>
      </article>

      {related.length > 0 ? (
        <div className="mt-16">
          <RelatedPosts posts={related} />
        </div>
      ) : null}
    </Container>
  );
}
