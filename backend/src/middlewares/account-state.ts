import type { Core } from '@strapi/strapi';
import { accountStateCache, TTL_MS } from './account-state-cache';

/**
 * Per-request account-state revalidation — RBAC.md, D-013.
 *
 * A JWT is stateless. Blocking a user writes a database row; it does not reach
 * into the browser and revoke the token they already hold. Strapi checks
 * `blocked` at the *login* endpoint only — verified empirically that replaying a
 * pre-block token against a protected endpoint still succeeds without this.
 *
 * So: on every request that carries a Bearer token, verify it, read the current
 * `blocked` flag, and 403 with `ACCOUNT_BLOCKED` if set. Runs as a global
 * middleware (before route auth), so it verifies the token itself.
 *
 * Cost: the `blocked` flag changes rarely, so the user read is memoised in
 * process for a short TTL (ACCOUNT_STATE_TTL_MS, default 20s) instead of hitting
 * the database on every authenticated request. The block/unblock action evicts
 * the affected entry immediately (accountStateCache.bust), so D-013's "bites on
 * the next request" contract still holds; the TTL only bounds drift from a
 * direct DB edit. At real scale this store moves to Redis or a shorter token
 * lifetime + refresh.
 */
const factory: Core.MiddlewareFactory = (_config, { strapi }) => {
  // Keep the map bounded on a long-lived process (mirrors rate-limit.ts).
  const sweep = setInterval(() => accountStateCache.sweep(), TTL_MS);
  sweep.unref?.();

  return async (ctx, next) => {
    const header = ctx.request.header.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      try {
        const payload = await strapi
          .service('plugin::users-permissions.jwt')
          .verify(token);

        const now = Date.now();
        let state = accountStateCache.get(payload.id);
        if (!state || state.expiresAt <= now) {
          const user = await strapi.db
            .query('plugin::users-permissions.user')
            .findOne({
              where: { id: payload.id },
              select: ['id', 'blocked', 'blockedReason'],
            });
          state = {
            blocked: Boolean(user?.blocked),
            blockedReason: user?.blockedReason ?? null,
            expiresAt: now + TTL_MS,
          };
          accountStateCache.set(payload.id, state);
        }

        if (state.blocked) {
          ctx.status = 403;
          ctx.body = {
            error: {
              status: 403,
              name: 'ForbiddenError',
              message: 'ACCOUNT_BLOCKED',
              details: { reason: state.blockedReason },
            },
          };
          return;
        }
      } catch {
        // Invalid / expired token — let the normal auth flow return 401.
      }
    }

    await next();
  };
};

export default factory;
