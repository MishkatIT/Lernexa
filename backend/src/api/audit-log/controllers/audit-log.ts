import { factories } from '@strapi/strapi';

/**
 * No routes reach this controller (see routes/audit-log.ts). It exists only so
 * the content type is well-formed. Reads go through GET /api/platform/audit.
 */
export default factories.createCoreController('api::audit-log.audit-log');
