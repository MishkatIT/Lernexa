import { factories } from '@strapi/strapi';
import { readingMinutes, excerpt } from '../services/reading';

const UID = 'api::blog-post.blog-post';
const MANAGER_ROLES = ['admin', 'content-manager'];
const CATEGORIES = [
  'engineering',
  'product',
  'programming',
  'web-development',
  'backend',
  'frontend',
  'ai',
  'career',
  'tutorials',
  'technology',
];

type CoreHelpers = {
  sanitizeQuery(ctx: unknown): Promise<Record<string, unknown>>;
  sanitizeOutput(data: unknown, ctx: unknown): Promise<unknown>;
  transformResponse(data: unknown, meta?: unknown): unknown;
};

type BlogAuthor = {
  fullName: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
} | null;

type BlogRow = {
  documentId: string;
  title: string;
  slug: string | null;
  subtitle?: string | null;
  category?: string | null;
  body: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  author?: BlogAuthor;
};

/** List/teaser shape — no `body`. Carries the derived teaser + minutes instead,
 *  so the feed payload stays small (D-004 discipline: names only what it needs). */
const shapeListItem = (b: BlogRow) => ({
  documentId: b.documentId,
  title: b.title,
  slug: b.slug,
  subtitle: b.subtitle ?? null,
  category: b.category ?? null,
  excerpt: b.subtitle?.trim() ? b.subtitle.trim() : excerpt(b.body),
  readingMinutes: readingMinutes(b.body),
  coverImageUrl: b.coverImageUrl ?? null,
  publishedAt: b.publishedAt ?? null,
  createdAt: b.createdAt ?? null,
  author: b.author ? { fullName: b.author.fullName ?? null } : null,
});

/** Full shape — the article page. Includes body + author avatar/bio. */
const shapeFull = (b: BlogRow) => ({
  documentId: b.documentId,
  title: b.title,
  slug: b.slug,
  subtitle: b.subtitle ?? null,
  category: b.category ?? null,
  body: b.body ?? null,
  readingMinutes: readingMinutes(b.body),
  coverImageUrl: b.coverImageUrl ?? null,
  publishedAt: b.publishedAt ?? null,
  createdAt: b.createdAt ?? null,
  author: b.author
    ? {
        fullName: b.author.fullName ?? null,
        avatarUrl: b.author.avatarUrl ?? null,
        bio: b.author.bio ?? null,
      }
    : null,
});

/**
 * Blog.
 *
 * - find / findOne: a non-manager (public, student, instructor) is FORCED to
 *   published only — `status=draft` from the query string is ignored. Managers
 *   may pass `status=draft` to see drafts.
 * - create: `author` is forced to ctx.state.user.id (content API rejects a
 *   `user` relation in input, so it's written via the document service).
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    const self = this as unknown as CoreHelpers;
    const isManager = MANAGER_ROLES.includes(ctx.state.user?.role?.type ?? '');
    const sanitized = await self.sanitizeQuery(ctx);

    // Non-managers are forced to published; a manager may ask for the draft set.
    const status =
      isManager && String(ctx.query?.status ?? '') === 'draft'
        ? 'draft'
        : 'published';

    // Title search + category filter, both ANDed onto the caller filters. WHERE
    // clauses, so they span every page and the `total` count tracks them.
    const q = (ctx.query?.q ?? '').toString().trim();
    const category = (ctx.query?.category ?? '').toString().trim();
    const extra: unknown[] = [];
    if (Object.keys((sanitized.filters as object) ?? {}).length) {
      extra.push(sanitized.filters);
    }
    if (q) extra.push({ title: { $containsi: q } });
    if (CATEGORIES.includes(category)) extra.push({ category: { $eq: category } });
    const filters = extra.length > 1 ? { $and: extra } : (extra[0] ?? undefined);

    // `body` is fetched so the teaser + reading time can be derived, but
    // shapeListItem drops it — the feed only ships the teaser.
    const { results, pagination } = (await strapi.service(UID).find({
      ...sanitized,
      filters,
      status,
      fields: [
        'title',
        'slug',
        'subtitle',
        'category',
        'body',
        'coverImageUrl',
        'publishedAt',
        'createdAt',
      ],
      populate: { author: { fields: ['fullName'] } },
      sort: ['publishedAt:desc'],
    })) as { results: BlogRow[]; pagination: unknown };

    return self.transformResponse(results.map(shapeListItem), { pagination });
  },

  async findOne(ctx) {
    const self = this as unknown as CoreHelpers;
    const isManager = MANAGER_ROLES.includes(ctx.state.user?.role?.type ?? '');

    const entity = (await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      status: isManager ? undefined : 'published', // non-managers: published only
      fields: ['title', 'slug', 'subtitle', 'category', 'body', 'coverImageUrl', 'publishedAt'],
      populate: { author: { fields: ['fullName', 'avatarUrl', 'bio'] } },
    })) as unknown as BlogRow | null;

    if (!entity) return ctx.notFound();
    return self.transformResponse(shapeFull(entity));
  },

  async create(ctx) {
    const self = this as unknown as CoreHelpers;
    const body = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

    const data: {
      title?: string;
      body?: string;
      subtitle?: string;
      category?: string;
      coverImageUrl?: string;
      slug?: string;
      author: number;
    } = { author: ctx.state.user.id }; // forced — never from the request
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.body === 'string') data.body = body.body;
    if (typeof body.subtitle === 'string') data.subtitle = body.subtitle;
    if (typeof body.category === 'string' && CATEGORIES.includes(body.category))
      data.category = body.category;
    if (typeof body.coverImageUrl === 'string')
      data.coverImageUrl = body.coverImageUrl;

    const base =
      typeof body.slug === 'string' && body.slug
        ? body.slug
        : (data.title ?? 'post');
    data.slug = `${base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`;

    // Created as a draft (no publishedAt) — the editor publishes explicitly.
    const entity = (await strapi.documents(UID).create({
      // @ts-expect-error Input type rejects a bare relation id; author is forced above.
      data,
      status: 'draft',
    })) as unknown as BlogRow;

    return self.transformResponse(shapeFull(entity));
  },

  /** POST /api/blog-posts/:id/publish */
  async publish(ctx) {
    const self = this as unknown as CoreHelpers;
    await strapi.documents(UID).publish({ documentId: ctx.params.id });
    const entity = (await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      status: 'published',
      fields: ['title', 'slug', 'subtitle', 'category', 'body', 'coverImageUrl', 'publishedAt'],
      populate: { author: { fields: ['fullName', 'avatarUrl', 'bio'] } },
    })) as unknown as BlogRow | null;
    if (!entity) return ctx.notFound();

    await strapi.service('api::audit-log.audit-log').record({
      action: 'blog.published',
      category: 'content',
      ctx,
      target: { type: 'blog-post', id: ctx.params.id, label: entity.title },
      metadata: { title: entity.title },
    });

    return self.transformResponse(shapeFull(entity));
  },

  /** POST /api/blog-posts/:id/unpublish */
  async unpublish(ctx) {
    const self = this as unknown as CoreHelpers;
    const existing = (await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      fields: ['title'],
    })) as unknown as { title?: string } | null;

    await strapi.documents(UID).unpublish({ documentId: ctx.params.id });

    await strapi.service('api::audit-log.audit-log').record({
      action: 'blog.unpublished',
      category: 'content',
      ctx,
      target: {
        type: 'blog-post',
        id: ctx.params.id,
        label: existing?.title ?? ctx.params.id,
      },
      metadata: existing?.title ? { title: existing.title } : {},
    });

    return self.transformResponse({ documentId: ctx.params.id, publishedAt: null });
  },

  /** DELETE /api/blog-posts/:id */
  async delete(ctx) {
    const existing = (await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      fields: ['title'],
    })) as unknown as { title?: string } | null;

    const result = await super.delete(ctx);

    if (existing) {
      await strapi.service('api::audit-log.audit-log').record({
        action: 'blog.deleted',
        category: 'content',
        ctx,
        target: {
          type: 'blog-post',
          id: ctx.params.id,
          label: existing.title ?? ctx.params.id,
        },
        metadata: existing.title ? { title: existing.title } : {},
      });
    }

    return result;
  },
}));
