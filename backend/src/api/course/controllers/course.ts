import { factories } from '@strapi/strapi';

// Ownership enforcement (forced instructor filter, delete guard) lands in Phase 3.
export default factories.createCoreController('api::course.course');
