import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPost } from "@/lib/blog";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  return { title: post?.title ?? "Post" };
}

export default async function BlogPostPage({ params }: Params) {
  const post = await getPublishedPost((await params).slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-[68ch]">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink-900">
        {post.title}
      </h1>
      <p className="mt-2 text-[13px] text-ink-500">
        {post.author?.fullName ? `${post.author.fullName} · ` : ""}
        {post.publishedAt
          ? new Date(post.publishedAt).toLocaleDateString()
          : ""}
      </p>
      <div className="mt-6 whitespace-pre-wrap font-serif text-[18px] leading-[1.7] text-ink-900">
        {post.body}
      </div>
    </article>
  );
}
