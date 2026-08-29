import type { PostAuthor } from "@/lib/blog";
import { Avatar } from "./Avatar";

/**
 * End-of-article author block. Shows what the user model actually holds —
 * avatar, name, bio. There's no follow graph in the platform, so there's no
 * follow button rather than a dead one.
 */
export function AuthorCard({ author }: { author: PostAuthor | null }) {
  const name = author?.fullName?.trim() || "Lernexa";
  const bio = author?.bio?.trim();

  return (
    <div className="flex gap-4 border-t border-ink-200 pt-8">
      <Avatar name={name} src={author?.avatarUrl} size={52} />
      <div className="min-w-0">
        <p className="text-small uppercase tracking-[0.1em] text-ink-500">
          Written by
        </p>
        <p className="mt-0.5 text-h3 text-ink-900">{name}</p>
        {bio ? (
          <p className="mt-1.5 max-w-prose text-body text-ink-700">{bio}</p>
        ) : null}
      </div>
    </div>
  );
}
