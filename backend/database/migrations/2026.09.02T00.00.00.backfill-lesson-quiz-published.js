'use strict';

/**
 * D-039 follow-up — re-backfill `lessons.published` / `quizzes.published`.
 *
 * `2026.09.01…content-visibility.js` already flips NULL -> true for these two
 * columns, but on at least one deployed database it ran before Strapi's schema
 * sync had added the `published` column: `hasColumn` was false, the backfill was
 * skipped, and that migration is now recorded as complete so it never runs
 * again. Visible symptom: the catalogue populate filters `published = true`
 * (SAFE_POPULATE in the course controller), so every course card shows
 * "0 lessons".
 *
 * This is a fresh migration name, so it runs once on the next boot regardless of
 * what the earlier one did. Idempotent and safe to keep in the repo: on a
 * database whose column is already populated the UPDATE matches zero rows.
 */
module.exports = {
  async up(knex) {
    for (const table of ['lessons', 'quizzes']) {
      if (!(await knex.schema.hasColumn(table, 'published'))) continue;
      const updated = await knex(table)
        .whereNull('published')
        .update({ published: true });
      if (updated > 0) {
        // eslint-disable-next-line no-console
        console.log(`[migration] backfilled ${updated} ${table}.published NULL -> true`);
      }
    }
  },

  async down() {
    // Data-only backfill; nothing to revert. The columns are owned by the
    // content-type schemas.
  },
};
