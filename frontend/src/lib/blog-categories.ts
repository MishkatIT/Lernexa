/**
 * Blog categories — the fixed set mirrored from the Strapi `blog-post.category`
 * enumeration. Client-safe (no `server-only`): the editor's <select>, the
 * article kicker and the topic bar all read from here.
 */
export type CategorySlug =
  | "engineering"
  | "product"
  | "programming"
  | "web-development"
  | "backend"
  | "frontend"
  | "ai"
  | "career"
  | "tutorials"
  | "technology";

export const CATEGORIES: { slug: CategorySlug; label: string }[] = [
  { slug: "engineering", label: "Engineering" },
  { slug: "product", label: "Product" },
  { slug: "programming", label: "Programming" },
  { slug: "web-development", label: "Web Development" },
  { slug: "backend", label: "Backend" },
  { slug: "frontend", label: "Frontend" },
  { slug: "ai", label: "AI" },
  { slug: "career", label: "Career" },
  { slug: "tutorials", label: "Tutorials" },
  { slug: "technology", label: "Technology" },
];

const LABELS = new Map(CATEGORIES.map((c) => [c.slug, c.label]));

export function categoryLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return LABELS.get(slug as CategorySlug) ?? null;
}

export function isCategorySlug(v: string | null | undefined): v is CategorySlug {
  return !!v && LABELS.has(v as CategorySlug);
}
