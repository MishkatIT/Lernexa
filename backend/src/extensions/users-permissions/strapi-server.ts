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

/**
 * `PUT /api/users/me` — a partial profile update. Every field is optional; only
 * the keys actually sent are written. `avatarUrl` holds either an http(s) URL or
 * a small client-resized image data URL (the frontend caps it near 256px, ~20 KB);
 * an empty string clears it. The 200 KB ceiling is a guard that also stays under
 * Strapi's 256 KB `strapi::body` JSON limit, so a valid image is never rejected
 * upstream of this check.
 */
const AVATAR_URL_RE =
  /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$|^https?:\/\/\S+$/;

const updateMeSchema = yup
  .object({
    fullName: yup.string().trim().min(1).max(120),
    bio: yup.string().trim().max(280).nullable(),
    avatarUrl: yup
      .string()
      .trim()
      .max(200000)
      .matches(AVATAR_URL_RE, {
        excludeEmptyString: true,
        message: 'avatarUrl must be an image data URL or an http(s) URL',
      })
      .nullable(),
  })
  .noUnknown();

const toMeResponse = (user: any) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  fullName: user.fullName ?? null,
  avatarUrl: user.avatarUrl ?? null,
  bio: user.bio ?? null,
  blocked: user.blocked,
  role: user.role
    ? { id: user.role.id, name: user.role.name, type: user.role.type }
    : null,
});

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

    ctx.body = toMeResponse(user);
  };

  // ---------------------------------------------------------------------------
  // PUT /api/users/me — the caller updates their own profile. Only `fullName`
  // and `avatarUrl` are writable; role, email, blocked and everything else are
  // untouchable here. Fields are optional — only what's sent is changed.
  // ---------------------------------------------------------------------------
  plugin.controllers.user.updateMe = async (ctx: any) => {
    if (!ctx.state.user?.id) return ctx.unauthorized();

    let input: yup.InferType<typeof updateMeSchema>;
    try {
      input = await updateMeSchema.validate(ctx.request.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (e: any) {
      // A raw yup ValidationError would otherwise surface as a 500.
      return ctx.badRequest(
        e?.errors?.[0] ?? e?.message ?? 'Invalid profile update',
      );
    }

    const data: Record<string, unknown> = {};
    if (input.fullName !== undefined) data.fullName = input.fullName.trim();
    if (input.bio !== undefined) {
      const v = (input.bio ?? '').trim();
      data.bio = v === '' ? null : v;
    }
    if (input.avatarUrl !== undefined) {
      const v = (input.avatarUrl ?? '').trim();
      data.avatarUrl = v === '' ? null : v;
    }
    if (Object.keys(data).length === 0) {
      return ctx.badRequest('No writable fields were provided');
    }

    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: ctx.state.user.id },
      data,
    });

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: ctx.state.user.id },
      populate: { role: true },
    });

    ctx.body = toMeResponse(user);
  };

  // unshift so `/users/me` matches before the core `/users/:id` route.
  plugin.routes['content-api'].routes.unshift({
    method: 'PUT',
    path: '/users/me',
    handler: 'user.updateMe',
    config: { prefix: '' },
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/local/register — see the schema + notes above.
  // ---------------------------------------------------------------------------
  const createAuthController = plugin.controllers.auth;

  plugin.controllers.auth = (params: any) => {
    const controller = createAuthController(params);
    const coreRegister = controller.register.bind(controller);
    const coreChangePassword = controller.changePassword?.bind(controller);

    // POST /api/auth/change-password — audit the fact, never the password.
    if (coreChangePassword) {
      controller.changePassword = async (ctx: any) => {
        await coreChangePassword(ctx); // throws on a wrong current password
        if (ctx.state.user?.id) {
          await strapi.service('api::audit-log.audit-log').record({
            action: 'account.password_changed',
            category: 'account',
            ctx,
            target: {
              type: 'user',
              id: ctx.state.user.id,
              label: ctx.state.user.email ?? `user ${ctx.state.user.id}`,
            },
            metadata: {},
          });
        }
      };
    }

    controller.register = async (ctx: any) => {
      // Gate on SiteSettings.registrationEnabled — enforced here, NOT by hiding
      // the signup link (Tier 2.5, D-026). No row yet → default open.
      const settings = await strapi.db
        .query('api::site-setting.site-setting')
        .findOne({});
      if (settings && settings.registrationEnabled === false) {
        return ctx.forbidden('Registration is currently disabled');
      }

      // Layer 1 — allowlist. stripUnknown drops everything else (incl. role) so
      // the request still succeeds; only an invalid email/password 400s.
      // A raw yup ValidationError would otherwise surface as a 500 (same guard
      // as updateMe above).
      let clean: yup.InferType<typeof registerBodySchema>;
      try {
        clean = await registerBodySchema.validate(ctx.request.body ?? {}, {
          abortEarly: false,
          stripUnknown: true,
        });
      } catch (e: any) {
        return ctx.badRequest(
          e?.errors?.[0] ?? e?.message ?? 'Invalid registration',
        );
      }

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

        await strapi.service('api::audit-log.audit-log').record({
          action: 'user.registered',
          category: 'account',
          ctx,
          actor: {
            id: created.id,
            label: fullName ? `${fullName} <${clean.email}>` : clean.email,
            role: 'student',
          },
          target: { type: 'user', id: created.id, label: clean.email },
          metadata: { email: clean.email },
        });
      }
    };

    return controller;
  };

  return plugin;
};
