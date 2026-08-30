import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guards";
import { getManagedPost } from "@/lib/blog";
import type { LivePublishState } from "@/lib/blog-status";
import { Badge } from "@/components/ui/Badge";
import { PostForm } from "@/components/manage/PostForm";
import { PostLiveControls } from "@/components/manage/PostLiveControls";

export const metadata: Metadata = { title: "Edit post" };

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  slug: "slug",
  subtitle: "subtitle",
  category: "category",
  body: "body",
  coverImageUrl: "cover image",
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

const listFields = (fields: string[]) => {
  const names = fields.map((f) => FIELD_LABELS[f] ?? f);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/** Badge tone + label + one line of explanation for each draft-vs-live state. */
function liveSummary(live: LivePublishState | null): {
  tone: "success" | "warning" | "neutral";
  label: string;
  detail: string;
} {
  switch (live?.state) {
    case "live":
      return {
        tone: "success",
        label: "Published",
        detail: "The draft matches what readers see — nothing to publish.",
      };
    case "modified":
      return {
        tone: "warning",
        label: "Unpublished changes",
        detail: `Draft edits to ${listFields(
          live.changedFields,
        )} aren't live yet. Publish from the blog list to push them.`,
      };
    case "unpublished":
      return {
        tone: "warning",
        label: "Unpublished",
        detail: live.lastPublishedAt
          ? `Taken down — was live until ${fmtDate(
              live.lastPublishedAt,
            )}. Readers get a 404.`
          : "Taken down. Readers get a 404.",
      };
    default:
      return {
        tone: "neutral",
        label: "Draft",
        detail: "Not published yet. Publish when it's ready.",
      };
  }
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "content-manager");
  const { id } = await params;
  const post = await getManagedPost(id);
  if (!post) notFound();

  const summary = liveSummary(post.live);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/manage/blog"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Blog
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-display text-ink-900">{post.title}</h1>
        <Badge tone={summary.tone}>{summary.label}</Badge>
        <PostLiveControls
          documentId={post.documentId}
          state={post.live?.state ?? "never_published"}
        />
      </div>
      <p className="mt-1 mb-8 text-small text-ink-500">{summary.detail}</p>
      <PostForm
        mode="edit"
        documentId={post.documentId}
        initial={{
          title: post.title,
          body: post.body ?? "",
          subtitle: post.subtitle ?? "",
          category: post.category ?? "",
          coverImageUrl: post.coverImageUrl ?? "",
        }}
      />
    </div>
  );
}
