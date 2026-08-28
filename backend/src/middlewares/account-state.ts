import type { Core } from '@strapi/strapi';

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
 * Cost: one indexed user read per authenticated request. At scale you'd cache
 * blocked ids in Redis with a short TTL, or shorten token lifetime + refresh.
 */
const factory: Core.MiddlewareFactory = (_config, { strapi }) => {
  return async (ctx, next) => {
    const header = ctx.request.header.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      try {
        const payload = await strapi
          .service('plugin::users-permissions.jwt')
          .verify(token);
        const user = await strapi.db
          .query('plugin::users-permissions.user')
          .findOne({
            where: { id: payload.id },
            select: ['id', 'blocked', 'blockedReason'],
          });

        if (user?.blocked) {
          ctx.status = 403;
          ctx.body = {
            error: {
              status: 403,
              name: 'ForbiddenError',
              message: 'ACCOUNT_BLOCKED',
              details: { reason: user.blockedReason ?? null },
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
