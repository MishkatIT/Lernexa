/**
 * Derived reading metadata for a post body — PURE functions, plain string in,
 * plain data out. No `ctx`, no Strapi, so reading.test.ts runs without booting
 * anything (same discipline as grading.ts / progress.ts).
 *
 * The blog body is authored as lightweight Markdown. Neither figure below needs
 * a real parser: for the excerpt we strip the handful of inline/blocky markers
 * to plain text; for the minutes we count words. Both are approximations shown
 * as "~N min read" / a teaser — precision is not the point.
 */

const WORDS_PER_MINUTE = 225;

/** Rough word count after stripping code fences (which shouldn't inflate time). */
export function readingMinutes(body: string | null | undefined): number {
  if (!body) return 1;
  const prose = body.replace(/```[\s\S]*?```/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * A plain-text teaser: first non-empty block, markdown markers removed, clamped
 * to `max` chars on a word boundary with an ellipsis. Headings and code blocks
 * are skipped so the teaser reads like a sentence.
 */
export function excerpt(
  body: string | null | undefined,
  max = 180,
): string {
  if (!body) return "";
  const blocks = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const firstProse =
    blocks.find(
      (b) => !b.startsWith("#") && !b.startsWith("```") && !b.startsWith(">"),
    ) ??
    blocks[0] ??
    "";

  const plain = firstProse
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links / images -> text
    .replace(/^[#>\-*\s]+/, "") // leftover leading markers
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= max) return plain;
  const clipped = plain.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
