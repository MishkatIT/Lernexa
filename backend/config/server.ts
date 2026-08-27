import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Public URL of the deployed API. Railway sets this; locally it stays unset
  // and Strapi falls back to host:port.
  url: env('PUBLIC_URL', undefined),
  // Railway terminates TLS at its edge proxy. Trust the proxy so Strapi builds
  // correct https URLs and reads the real client IP.
  proxy: env.bool('IS_PROXIED', false),
  app: {
    keys: env.array('APP_KEYS')!,
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});

export default config;
