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
  lastPublishedAt?: string | null;
  author?: BlogAuthor;
};

/**
 * Draft-vs-live comparison (managers only). Native Draft & Publish keeps two
 * rows per `documentId` — a draft and, when live, a published one. Editing after
 * a publish touches only the draft. We report which of four states the post is
 * in so the editor can say plainly "the draft matches what readers see" or list
 * exactly what would change on publish.
 *
 *   never_published — no published row, none ever (lastPublishedAt is null)
 *   unpublished     — no published row now, but it was live before (taken down)
 *   live            — published row exists and the draft is identical to it
 *   modified        — published row exists but the draft has unpublished edits
 *
 * Comparison is field-by-field on content only — a no-op re-save (which bumps
 * `updatedAt`) must not read as "modified".
 */
const LIVE_COMPARE_FIELDS = [
  'title',
  'slug',
  'subtitle',
  'category',
  'body',
  'coverImageUrl',
] as const;

type LivePublishState = {
  state: 'never_published' | 'unpublished' | 'live' | 'modified';
  publishedAt: string | null;
  lastPublishedAt: string | null;
  changedFields: string[];
};

const sameFieldValue = (a: unknown, b: unknown): boolean =>
  String(a ?? '') === String(b ?? '');

const deriveLive = (draft: BlogRow, published: BlogRow | null): LivePublishState => {
  const lastPublishedAt = draft.lastPublishedAt ?? null;
  if (published) {
    const changedFields = LIVE_COMPARE_FIELDS.filter(
      (f) => !sameFieldValue(draft[f], published[f]),
    );
    return {
      state: changedFields.length > 0 ? 'modified' : 'live',
      publishedAt: published.publishedAt ?? null,
      lastPublishedAt,
      changedFields,
    };
  }
  return {
    state: lastPublishedAt ? 'unpublished' : 'never_published',
    publishedAt: null,
    lastPublishedAt,
    changedFields: [],
  };
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
  lastPublishedAt: b.lastPublishedAt ?? null,
  createdAt: b.createdAt ?? null,
  author: b.author ? { fullName: b.author.fullName ?? null } : null,
});

/** Full shape — the article page. Includes body + author avatar/bio. `live` is
 *  set only for manager reads (the draft-vs-published comparison); a public read
 *  passes it through as null. */
const shapeFull = (b: BlogRow, live: LivePublishState | null = null) => ({
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
  live,
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
        'lastPublishedAt',
        'createdAt',
      ],
      populate: { author: { fields: ['fullName'] } },
      sort: ['publishedAt:desc'],
    })) as { results: BlogRow[]; pagination: unknown };

    // For a manager list, attach the same draft-vs-live state `findOne` returns,
    // so the list can badge "Unpublished changes" — not just published/draft.
    // One extra query for the counterpart version of the rows on this page.
    let liveByDoc: Map<string, LivePublishState> | null = null;
    if (isManager && results.length > 0) {
      const ids = results.map((r) => r.documentId);
      const { results: counterpart } = (await strapi.service(UID).find({
        filters: { documentId: { $in: ids } },
        status: status === 'draft' ? 'published' : 'draft',
        fields: ['title', 'slug', 'subtitle', 'category', 'body', 'coverImageUrl', 'publishedAt', 'lastPublishedAt'],
        pagination: { pageSize: ids.length },
      })) as { results: BlogRow[] };
      const otherByDoc = new Map(counterpart.map((o) => [o.documentId, o]));
      liveByDoc = new Map(
        results.map((r) => {
          const other = otherByDoc.get(r.documentId) ?? null;
          const draft = status === 'draft' ? r : other;
          const published = status === 'published' ? r : other;
          return [r.documentId, deriveLive(draft ?? r, published)];
        }),
      );
    }

    return self.transformResponse(
      results.map((r) => ({
        ...shapeListItem(r),
        live: liveByDoc?.get(r.documentId) ?? null,
      })),
      { pagination },
    );
  },

  async findOne(ctx) {
    const self = this as unknown as CoreHelpers;
    const isManager = MANAGER_ROLES.includes(ctx.state.user?.role?.type ?? '');

    if (!isManager) {
      const entity = (await strapi.documents(UID).findOne({
        documentId: ctx.params.id,
        status: 'published', // non-managers: published only
        fields: ['title', 'slug', 'subtitle', 'category', 'body', 'coverImageUrl', 'publishedAt'],
        populate: { author: { fields: ['fullName', 'avatarUrl', 'bio'] } },
      })) as unknown as BlogRow | null;

      if (!entity) return ctx.notFound();
      return self.transformResponse(shapeFull(entity));
    }

    // Manager read: return the draft (what the editor works on) plus a
    // draft-vs-live comparison. Two point reads on the same documentId — the
    // published one is null when the post has never been published or was taken
    // down.
    const [draft, published] = (await Promise.all([
      strapi.documents(UID).findOne({
        documentId: ctx.params.id,
        status: 'draft',
        fields: [
          'title',
          'slug',
          'subtitle',
          'category',
          'body',
          'coverImageUrl',
          'publishedAt',
          'lastPublishedAt',
        ],
        populate: { author: { fields: ['fullName', 'avatarUrl', 'bio'] } },
      }),
      strapi.documents(UID).findOne({
        documentId: ctx.params.id,
        status: 'published',
        fields: ['title', 'slug', 'subtitle', 'category', 'body', 'coverImageUrl', 'publishedAt'],
      }),
    ])) as unknown as [BlogRow | null, BlogRow | null];

    if (!draft) return ctx.notFound();
    return self.transformResponse(shapeFull(draft, deriveLive(draft, published)));
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
    // Stamp the draft first so `lastPublishedAt` rides into the published row on
    // the publish below: the two versions stay identical (no false "modified"
    // right after publishing), and the value survives a later unpublish — which
    // only deletes the published row — so we can still tell "taken down" from
    // "never published".
    await strapi.documents(UID).update({
      documentId: ctx.params.id,
      data: { lastPublishedAt: new Date() },
    });
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
