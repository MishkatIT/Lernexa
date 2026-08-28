'use strict';

/**
 * Indexes for the columns the app actually filters and sorts on. Strapi does
 * not create these from schema.json, and at a realistic data volume (tens of
 * courses, hundreds of enrolments, a growing audit log) they matter.
 *
 *  - audit_logs: every /api/platform/audit query sorts by created_at and
 *    filters by category / action.
 *  - blog_posts.published_at: read on every anonymous /blog request
 *    (published-only is `published_at IS NOT NULL`).
 *  - courses.created_at: the catalogue's default sort + pagination.
 *
 * Idempotent — checks pg_indexes first, safe on every deploy.
 */
async function ensureIndex(knex, table, columns, name) {
  const hasTable = await knex.schema.hasTable(table);
  if (!hasTable) return;
  for (const col of columns) {
    if (!(await knex.schema.hasColumn(table, col))) return;
  }
  const { rows } = await knex.raw(
    'select 1 from pg_indexes where tablename = ? and indexname = ?',
    [table, name],
  );
  if (rows.length > 0) return;
  await knex.schema.alterTable(table, (t) => t.index(columns, name));
}

const INDEXES = [
  ['audit_logs', ['created_at'], 'audit_logs_created_at_idx'],
  ['audit_logs', ['category'], 'audit_logs_category_idx'],
  ['audit_logs', ['action'], 'audit_logs_action_idx'],
  ['blog_posts', ['published_at'], 'blog_posts_published_at_idx'],
  ['courses', ['created_at'], 'courses_created_at_idx'],
];

module.exports = {
  async up(knex) {
    for (const [table, cols, name] of INDEXES) {
      await ensureIndex(knex, table, cols, name);
    }
  },
  async down(knex) {
    for (const [table, cols, name] of INDEXES) {
      await knex.schema
        .alterTable(table, (t) => t.dropIndex(cols, name))
        .catch(() => {});
    }
  },
};
