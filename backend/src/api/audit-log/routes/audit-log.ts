import { factories } from '@strapi/strapi';

/**
 * No public CRUD surface at all. The type is written only by the internal
 * `audit` service and read only through GET /api/platform/audit (admin-only).
 * Removing every core route means there is nothing to accidentally grant.
 */
export default factories.createCoreRouter('api::audit-log.audit-log', {
  except: ['find', 'findOne', 'create', 'update', 'delete'],
});
