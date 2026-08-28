import type { Core } from '@strapi/strapi';

/**
 * CORS is the one Strapi middleware we configure by hand. Strapi is the
 * security boundary and the browser never calls it directly under our
 * architecture (Next.js talks to Strapi server-to-server), but the Vercel
 * origin still needs to be allow-listed for the few browser-visible cases and
 * for local development. Origins come from `CORS_ORIGINS` (comma-separated).
 *
 * `global::rate-limit` config comes in here too — env-driven so it can be
 * tuned or disabled per environment without a code change.
 */
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: env.array('CORS_ORIGINS', ['http://localhost:3000']),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  // Per-IP write-traffic ceiling (auth endpoints already limited by U&P).
  {
    name: 'global::rate-limit',
    config: {
      enabled: env.bool('RATE_LIMIT_ENABLED', true),
      max: env.int('RATE_LIMIT_MAX', 60),
    },
  },
  // Per-request block check — 403 ACCOUNT_BLOCKED before any route runs (D-013).
  'global::account-state',
];

export default config;
