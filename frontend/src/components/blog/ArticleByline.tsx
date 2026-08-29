import { Avatar } from "./Avatar";

/** author avatar · name · date · N min read — the line under every title. */
export function ArticleByline({
  authorName,
  authorAvatarUrl,
  date,
  readingMinutes,
  size = "sm",
}: {
  authorName: string | null;
  authorAvatarUrl?: string | null;
  date: string | null;
  readingMinutes?: number | null;
  size?: "sm" | "md";
}) {
  const name = authorName?.trim() || "Lernexa";
  const when = date
    ? new Date(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex items-center gap-2.5 text-small text-ink-500">
      <Avatar name={name} src={authorAvatarUrl} size={size === "md" ? 36 : 26} />
      <span className="text-ink-700">{name}</span>
      {when ? (
        <>
          <span aria-hidden className="text-ink-200">
            ·
          </span>
          <time>{when}</time>
        </>
      ) : null}
      {readingMinutes ? (
        <>
          <span aria-hidden className="text-ink-200">
            ·
          </span>
          <span>{readingMinutes} min read</span>
        </>
      ) : null}
    </div>
  );
}
