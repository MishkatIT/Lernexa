'use strict';

/**
 * D-038 — per-course lesson progression rule.
 *
 * `course.lessonProgression` is a new enum column (`free` | `complete_locked` |
 * `open_locked`, default `free`). Strapi's schema sync adds the column on boot,
 * but whether it backfills existing rows and sets a DB-level default is version
 * dependent — so this migration makes the safe state explicit:
 *
 *   - every existing course with a NULL / empty value becomes `free`
 *     (existing courses keep working exactly as before — no sequential lock);
 *   - the column default is set to `free` so any row inserted outside the
 *     controller still lands unlocked.
 *
 * Idempotent — the UPDATE only touches NULL/'' rows and the ALTER is a no-op if
 * the default already matches. Safe to re-run on every deploy.
 */
module.exports = {
  async up(knex) {
    const hasColumn = await knex.schema.hasColumn('courses', 'lesson_progression');
    if (!hasColumn) return; // schema sync hasn't created it yet — nothing to do

    await knex('courses')
      .whereNull('lesson_progression')
      .orWhere('lesson_progression', '')
      .update({ lesson_progression: 'free' });

    await knex.schema
      .alterTable('courses', (t) => {
        t.string('lesson_progression').notNullable().defaultTo('free').alter();
      })
      .catch(() => {
        // Some engines/permissions disallow ALTER … ALTER COLUMN; the data
        // backfill above is the part that matters. Ignore.
      });
  },

  async down(knex) {
    // The column itself is owned by the content-type schema, not this
    // migration; only the default is reverted.
    await knex.schema
      .alterTable('courses', (t) => {
        t.string('lesson_progression').nullable().defaultTo(null).alter();
      })
      .catch(() => {});
  },
};
