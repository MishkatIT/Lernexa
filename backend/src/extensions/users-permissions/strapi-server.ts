import { yup } from '@strapi/utils';

/**
 * Public-registration hardening — docs/DATA_MODEL.md "Registration hardening",
 * DECISIONS.md D-008 / D-030.
 *
 * Accepting a `role` (or `confirmed`, `blocked`, ...) from an unauthenticated
 * request is direct privilege escalation. Two layers close it:
 *
 *   1. A yup allowlist strips the body down to exactly { email, password,
 *      fullName }. Strapi 5.52 core already rejects unknown params, but we do
 *      not outsource this — strip first so a stray field never reaches core.
 *   2. After the account exists, its role is set to `student` from a
 *      server-resolved id. The request never chooses the role.
 *
 * The U&P `auth` controller is a factory — `({ strapi }) => ({ register, ... })`
 * — so we wrap the factory, not a method.
 */
const registerBodySchema = yup
  .object({
    email: yup.string().email().required(),
    password: yup.string().min(6).required(),
    fullName: yup.string().trim().min(1).max(120),
  })
  .noUnknown();

export default (plugin: any) => {
  // ---------------------------------------------------------------------------
  // GET /api/users/me — return the caller's role.
  //
  // Strapi 5.52's stock `me` ignores `populate` for the role relation, so the
  // frontend can never learn "am I an instructor?". We rebuild the response by
  // explicit field mapping (same discipline as toStudentQuiz, D-004): it can
  // only contain what it names, and it only ever reads the caller's own row.
  // ---------------------------------------------------------------------------
  // The `user` controller is a plain object of methods (unlike `auth`, which is
  // a factory), so patch the method in place.
  plugin.controllers.user.me = async (ctx: any) => {
    if (!ctx.state.user?.id) {
      return ctx.unauthorized();
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: ctx.state.user.id },
      populate: { role: true },
    });

    ctx.body = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName ?? null,
      blocked: user.blocked,
      role: user.role
        ? { id: user.role.id, name: user.role.name, type: user.role.type }
        : null,
    };
  };

  // ---------------------------------------------------------------------------
  // POST /api/auth/local/register — see the schema + notes above.
  // ---------------------------------------------------------------------------
  const createAuthController = plugin.controllers.auth;

  plugin.controllers.auth = (params: any) => {
    const controller = createAuthController(params);
    const coreRegister = controller.register.bind(controller);

    controller.register = async (ctx: any) => {
      // Layer 1 — allowlist. stripUnknown drops everything else (incl. role) so
      // the request still succeeds; only an invalid email/password 400s.
      const clean = await registerBodySchema.validate(ctx.request.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });

      const fullName = clean.fullName?.trim() || undefined;

      // Only these reach core. username is required + unique in U&P and the
      // sign-up form has no username field, so the email doubles as it.
      ctx.request.body = {
        username: clean.email,
        email: clean.email,
        password: clean.password,
      };

      await coreRegister(ctx);

      // Layer 2 — force role server-side, whatever the request contained.
      const created = ctx.response?.body?.user;
      if (created?.id) {
        const studentRole = await strapi.db
          .query('plugin::users-permissions.role')
          .findOne({ where: { type: 'student' } });

        await strapi.db.query('plugin::users-permissions.user').update({
          where: { id: created.id },
          data: {
            role: studentRole?.id,
            ...(fullName ? { fullName } : {}),
          },
        });

        ctx.response.body.user = {
          ...created,
          fullName: fullName ?? created.fullName ?? null,
          role: studentRole
            ? { id: studentRole.id, name: studentRole.name, type: studentRole.type }
            : created.role,
        };
      }
    };

    return controller;
  };

  return plugin;
};
