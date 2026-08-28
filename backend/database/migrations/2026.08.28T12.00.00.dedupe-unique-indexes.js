'use strict';

/**
 * The real concurrency guarantee for "one enrolment per (student, course)" and
 * "one completion per (student, lesson)" — D-009, D-031.
 *
 * Strapi 5 splits each relation into its own link table, so a composite unique
 * across (student, course) isn't a table constraint. Instead each row carries a
 * server-set `dedupe_key` ("<userId>:<courseId>" / "<userId>:<lessonId>"); this
 * migration puts a UNIQUE index on it. `schema.json` sets `unique: true` too,
 * but 5.52 doesn't mirror that to the database on its own.
 *
 * Idempotent — safe to re-run on every deploy.
 */
async function addUnique(knex, table) {
  const hasColumn = await knex.schema.hasColumn(table, 'dedupe_key');
  if (!hasColumn) return;

  const indexName = `${table}_dedupe_key_unique`;
  const { rows } = await knex.raw(
    'select 1 from pg_indexes where tablename = ? and indexname = ?',
    [table, indexName],
  );
  if (rows.length > 0) return;

  await knex.schema.alterTable(table, (t) => {
    t.unique(['dedupe_key'], { indexName });
  });
}

module.exports = {
  async up(knex) {
    await addUnique(knex, 'enrollments');
    await addUnique(knex, 'lesson_completions');
  },
  async down(knex) {
    await knex.schema
      .alterTable('enrollments', (t) =>
        t.dropUnique(['dedupe_key'], 'enrollments_dedupe_key_unique'),
      )
      .catch(() => {});
    await knex.schema
      .alterTable('lesson_completions', (t) =>
        t.dropUnique(['dedupe_key'], 'lesson_completions_dedupe_key_unique'),
      )
      .catch(() => {});
  },
};
