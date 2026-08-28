import type { Core } from '@strapi/strapi';

/**
 * CORS is the one middleware we configure by hand. Strapi is the security
 * boundary and the browser never calls it directly under our architecture
 * (Next.js talks to Strapi server-to-server), but the Vercel origin still
 * needs to be allow-listed for the few browser-visible cases and for local
 * development. Origins come from `CORS_ORIGINS` as a comma-separated list.
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
  // Per-request block check — 403 ACCOUNT_BLOCKED before any route runs (D-013).
  'global::account-state',
];

export default config;
