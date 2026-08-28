import { factories } from '@strapi/strapi';

const UID = 'api::site-setting.site-setting';
const AUDITED_FIELDS = ['siteName', 'registrationEnabled'] as const;

/**
 * PUT /api/site-setting is admin-only (routes). We wrap `update` to record a
 * `settings.updated` audit entry with the before/after of each changed field —
 * turning off registration is the entry that matters most.
 */
export default factories.createCoreController(UID, ({ strapi }) => ({
  async update(ctx) {
    const before = await strapi.db.query(UID).findOne({});
    const result = await super.update(ctx);
    const after = await strapi.db.query(UID).findOne({});

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of AUDITED_FIELDS) {
      if (before?.[key] !== after?.[key]) {
        changes[key] = { from: before?.[key] ?? null, to: after?.[key] ?? null };
      }
    }

    if (Object.keys(changes).length > 0) {
      await strapi.service('api::audit-log.audit-log').record({
        action: 'settings.updated',
        category: 'security',
        ctx,
        target: { type: 'site-setting', id: 'site-setting', label: 'Site settings' },
        metadata: { changes },
      });
    }

    return result;
  },
}));
