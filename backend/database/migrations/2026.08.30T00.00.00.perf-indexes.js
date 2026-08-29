'use strict';

/**
 * Round two of query indexes (after 2026.08.29 query-indexes.js). These cover
 * the sort/filter columns the app hits on the hot read paths that grow with
 * usage — quiz attempts, the roster, completion activity, and slug lookups.
 *
 *  - quiz_attempts.submitted_at   — GET /api/quiz-attempts/me orders by it desc.
 *  - lesson_completions.completed_at — the stats "active in the last 7 days"
 *    and instructor "last activity" both range-scan this.
 *  - enrollments.enrolled_at      — the student-progress roster orders by it.
 *  - lessons.order                — every learn / lesson list sorts by it.
 *  - audit_logs.actor_id          — the audit filter by actor.
 *  - courses.slug / blog_posts.slug — the public detail pages resolve by slug.
 *
 * Idempotent — checks pg_indexes first, safe on every deploy.
 */
async function ensureIndex(knex, table, columns, name) {
  if (!(await knex.schema.hasTable(table))) return;
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
  ['quiz_attempts', ['submitted_at'], 'quiz_attempts_submitted_at_idx'],
  ['lesson_completions', ['completed_at'], 'lesson_completions_completed_at_idx'],
  ['enrollments', ['enrolled_at'], 'enrollments_enrolled_at_idx'],
  ['lessons', ['order'], 'lessons_order_idx'],
  ['audit_logs', ['actor_id'], 'audit_logs_actor_id_idx'],
  ['courses', ['slug'], 'courses_slug_idx'],
  ['blog_posts', ['slug'], 'blog_posts_slug_idx'],
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
