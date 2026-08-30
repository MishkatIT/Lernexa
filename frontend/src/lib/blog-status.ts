// Neutral blog draft/publish state — shared by the server data layer
// (`lib/blog.ts`, which is `server-only`) and the client `ManagedPostList` /
// `PostLiveControls`. Keep this module free of server-only imports so it is safe
// in both bundles.

/**
 * Draft-vs-live state for a post (managers only — the backend computes it on
 * manager `find` / `findOne`). `changedFields` are backend attribute names.
 *   never_published — draft only, never published
 *   unpublished     — was live, taken down; still has a draft
 *   live            — published, and the draft matches it exactly
 *   modified        — published, but the draft has edits not yet pushed live
 */
export type LivePublishState = {
  state: "never_published" | "unpublished" | "live" | "modified";
  publishedAt: string | null;
  lastPublishedAt: string | null;
  changedFields: string[];
};

export type PostBadgeState = "published" | "modified" | "unpublished" | "draft";

/**
 * The badge state for a managed post. Prefers the backend `live` comparison
 * (which can see "modified"); falls back to the timestamps when it's absent.
 */
export function postBadgeState(p: {
  publishedAt: string | null;
  lastPublishedAt: string | null;
  live?: LivePublishState | null;
}): PostBadgeState {
  switch (p.live?.state) {
    case "live":
      return "published";
    case "modified":
      return "modified";
    case "unpublished":
      return "unpublished";
    case "never_published":
      return "draft";
    default:
      if (p.publishedAt) return "published";
      if (p.lastPublishedAt) return "unpublished";
      return "draft";
  }
}
