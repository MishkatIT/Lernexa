'use strict';

/**
 * D-039 — course / lesson / quiz visibility.
 *
 * New columns land via Strapi's schema sync on boot:
 *   - courses.status         enum: draft | enrolled_only | published, default 'draft'
 *   - lessons.published      boolean, default true
 *   - quizzes.published      boolean, default true
 *
 * The lesson/quiz defaults are harmless for existing rows (true = visible, the
 * behaviour before this change). The course default is NOT: a fresh column would
 * leave every existing course as `draft` and empty the public catalogue. This
 * migration makes the safe state explicit — every course that exists at the
 * moment the feature ships was already live, so it becomes `published`.
 *
 * Runs once (tracked in `strapi_migrations`). By the time it runs, no course
 * created through the new controller can legitimately be `draft` yet, so
 * flipping every `draft` / NULL row to `published` is correct.
 */
module.exports = {
  async up(knex) {
    if (await knex.schema.hasColumn('courses', 'status')) {
      await knex('courses')
        .where((q) =>
          q.whereNull('status').orWhere('status', '').orWhere('status', 'draft'),
        )
        .update({ status: 'published' });

      await knex.schema
        .alterTable('courses', (t) => {
          t.string('status').notNullable().defaultTo('draft').alter();
        })
        .catch(() => {
          // ALTER … ALTER COLUMN not permitted on this engine — the backfill
          // above is the part that matters.
        });
    }

    for (const table of ['lessons', 'quizzes']) {
      if (await knex.schema.hasColumn(table, 'published')) {
        await knex(table).whereNull('published').update({ published: true });
      }
    }
  },

  async down(knex) {
    // Columns are owned by the content-type schemas, not this migration. Only
    // the course default is reverted so a rollback matches the schema again.
    await knex.schema
      .alterTable('courses', (t) => {
        t.string('status').notNullable().defaultTo('draft').alter();
      })
      .catch(() => {});
  },
};
