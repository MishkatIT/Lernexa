import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPost } from "@/lib/blog";
import { Container } from "@/components/ui/Container";

type Params = { params: Promise<{ slug: string }> };

const readingTime = (body: string | null) =>
  Math.max(1, Math.round((body?.split(/\s+/).length ?? 0) / 200));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  return { title: post?.title ?? "Post" };
}

export default async function BlogPostPage({ params }: Params) {
  const post = await getPublishedPost((await params).slug);
  if (!post) notFound();

  return (
    <Container size="reading" className="py-10 sm:py-16">
      <Link
        href="/blog"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Blog
      </Link>

      <article className="mt-6">
        <h1 className="text-display text-ink-900">{post.title}</h1>
        <p className="mt-3 text-small text-ink-500">
          {post.author?.fullName ? `${post.author.fullName} · ` : ""}
          {post.publishedAt
            ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : ""}
          {" · "}
          {readingTime(post.body)} min read
        </p>

        <div className="mt-8 whitespace-pre-wrap font-serif text-reading text-ink-900">
          {post.body}
        </div>
      </article>
    </Container>
  );
}
