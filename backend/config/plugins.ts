import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedTypes = [
  'image/svg+xml',
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      // Classic long-lived plugin JWT, NOT the access/refresh session model the
      // scaffold opted into. Our architecture is one Strapi JWT held in one
      // httpOnly cookie (DECISIONS.md D-002); refresh-token rotation is a named
      // limitation, not a feature. `legacy-support` is also the plugin default.
      jwtManagement: 'legacy-support',
      jwt: {
        expiresIn: '7d',
      },
      // The plugin throttles the auth endpoints per-IP (default 10 / 60s, and
      // `/auth/local` is keyed by IP only). The integration test suite logs in
      // as several accounts back-to-back and trips that. RATE_LIMIT_ENABLED is
      // the same flag that disables our own write limiter (src/middlewares/
      // rate-limit.ts) — when it is explicitly "false", lift the auth ceiling
      // too so `npm test` can run without spurious 429s. Production is
      // untouched (the flag defaults to enabled).
      ratelimit: {
        interval: 60_000,
        max: env('RATE_LIMIT_ENABLED', 'true') === 'false' ? 100_000 : 10,
      },
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes,
      },
    },
  },
});

export default config;
