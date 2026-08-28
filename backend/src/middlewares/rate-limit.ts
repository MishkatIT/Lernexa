import type { Core } from '@strapi/strapi';

/**
 * Coarse abuse ceiling on write traffic.
 *
 * Strapi's users-permissions plugin already rate-limits the auth endpoints
 * (login / register: ~10 / 60s). This adds a per-IP cap on *all other*
 * mutating API calls — `POST /api/quizzes/:id/submit` (one quiz_attempt row
 * each), `enroll`, lesson completions, content edits, the platform mutations.
 * Reads are untouched.
 *
 * In-memory sliding window. Correct for the single Railway instance we run; a
 * horizontally-scaled deployment would move this to Redis (same note as the
 * account-state middleware).
 */

type Hit = number[]; // request timestamps (ms), newest last

const WINDOW_MS = 60_000;
const MAX_DEFAULT = 60;
// Auth-adjacent writes that deserve a tighter bucket.
const STRICT_PATHS = ['/api/auth/change-password'];
const STRICT_MAX = 5;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const clientIp = (ctx: any): string => {
  const fwd = ctx.request.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return ctx.request.ip || 'unknown';
};

const factory: Core.MiddlewareFactory = (config: unknown) => {
  const c = (config ?? {}) as { enabled?: boolean; max?: number };
  const enabled = c.enabled ?? true;
  const max = Number(c.max) || MAX_DEFAULT;

  const buckets = new Map<string, Hit>();

  // Keep the map from growing without bound on a long-lived process.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, hits] of buckets) {
      const kept = hits.filter((t) => t > cutoff);
      if (kept.length === 0) buckets.delete(key);
      else buckets.set(key, kept);
    }
  }, WINDOW_MS);
  sweep.unref?.();

  return async (ctx, next) => {
    if (!enabled || !MUTATING.has(ctx.request.method)) return next();
    if (!ctx.request.path.startsWith('/api/')) return next();

    const strict = STRICT_PATHS.some((p) => ctx.request.path.startsWith(p));
    const limit = strict ? STRICT_MAX : max;
    const key = `${strict ? 's' : 'g'}:${clientIp(ctx)}`;

    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

    if (hits.length >= limit) {
      const retry = Math.ceil((hits[0] + WINDOW_MS - now) / 1000);
      ctx.set('Retry-After', String(Math.max(retry, 1)));
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequests',
          message: 'Too many requests — slow down and try again shortly.',
        },
      };
      return;
    }

    hits.push(now);
    buckets.set(key, hits);
    await next();
  };
};

export default factory;
