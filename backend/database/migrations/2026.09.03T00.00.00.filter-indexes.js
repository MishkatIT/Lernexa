'use strict';

/**
 * Round three of query indexes (after 2026.08.29 query-indexes.js and
 * 2026.08.30 perf-indexes.js). These cover the visibility columns every
 * catalogue / learn / manage read filters on — added with D-039 but never
 * indexed, so each read seq-scans the table.
 *
 *  - courses.status      — the public catalogue's forced `status = 'published'`
 *    filter (course.find), on every /courses render and every by-slug lookup.
 *  - lessons.published    — `SAFE_POPULATE` filters `published = true` when it
 *    populates a course's lessons; the /learn context and the roster do too.
 *  - quizzes.published    — the /learn context and the student quiz gate select
 *    the one `published` quiz for a course.
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
  ['courses', ['status'], 'courses_status_idx'],
  ['lessons', ['published'], 'lessons_published_idx'],
  ['quizzes', ['published'], 'quizzes_published_idx'],
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
