import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  // Strapi treats `server.url` as the site's base URL. If it's given without a
  // scheme (e.g. "app.up.railway.app") it gets read as a path segment, which
  // breaks every admin asset URL. Force a scheme so a bare host still works,
  // and trim any trailing slash.
  const raw = env('PUBLIC_URL', '');
  const url = raw
    ? (/^https?:\/\//.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, '')
    : undefined;

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    url,
    // Railway terminates TLS at its edge proxy. Trust the proxy so Strapi
    // builds correct https URLs and reads the real client IP.
    proxy: env.bool('IS_PROXIED', false),
    app: {
      keys: env.array('APP_KEYS')!,
    },
    webhooks: {
      populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
    },
  };
};

export default config;
