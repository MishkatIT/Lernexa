'use strict';

/**
 * Danger: wipes all seeded application data so `npm run seed` can rebuild it
 * from a clean slate. For LOCAL DEVELOPMENT ONLY.
 *
 *   npm run seed:reset          # refuses unless the DB looks local
 *   npm run seed:reset -- --force
 *
 * What it removes:
 *   - every row in courses, lessons, quizzes (+ components), enrollments,
 *     lesson_completions, quiz_attempts, blog_posts, audit_logs
 *   - every generated user (email ending @lernexa.dev)
 *   - resets the blocked flag on the demo accounts (@lernexa.test) so the seed
 *     re-applies it deterministically
 *
 * What it keeps:
 *   - the four application roles and all permission grants
 *   - the six demo accounts (admin@/cm@/instructor@/instructor2@/student@/blocked@)
 *   - the SiteSettings row
 *
 * Why a reset script exists at all: `seed.js` is idempotent, but only for a
 * FIXED script. If you change the set of generated users or their ordering, a
 * re-run layers a second dataset on top of the first (every dedupe key is new).
 * When that happens, reset and re-seed.
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi');

const FORCE = process.argv.includes('--force');

// base tables only — Strapi's *_lnk / *_cmps tables have ON DELETE CASCADE
const CONTENT_TABLES = [
  'audit_logs',
  'quiz_attempts',
  'lesson_completions',
  'enrollments',
  'components_quiz_options',
  'components_quiz_questions',
  'quizzes',
  'lessons',
  'courses',
  'blog_posts',
];

async function run(strapi) {
  const knex = strapi.db.connection;
  const client = knex.client.config.client;
  const conn = knex.client.config.connection || {};
  const dbName = conn.database || conn.connectionString || '';
  const host = conn.host || '';
  const looksLocal =
    client === 'sqlite' ||
    ['localhost', '127.0.0.1', '::1', ''].includes(String(host));

  strapi.log.warn(`[reset] target: client=${client} host=${host || '(local)'} db=${dbName}`);
  if (!looksLocal && !FORCE) {
    strapi.log.error('[reset] DB does not look local. Re-run with --force if you are sure.');
    return { aborted: true };
  }

  const before = {};
  for (const t of CONTENT_TABLES) {
    try {
      before[t] = Number((await knex(t).count({ n: '*' }))[0].n);
    } catch {
      before[t] = 'n/a';
    }
  }
  strapi.log.info(`[reset] row counts before: ${JSON.stringify(before)}`);

  // Truncate content. CASCADE also clears the link/component join tables.
  for (const t of CONTENT_TABLES) {
    try {
      await knex.raw(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`);
      strapi.log.info(`[reset] truncated ${t}`);
    } catch (e) {
      strapi.log.warn(`[reset] skip ${t}: ${e.message}`);
    }
  }

  // Generated users + their relation links.
  const genUsers = await knex('up_users').where('email', 'like', '%@lernexa.dev').select('id');
  const ids = genUsers.map((u) => u.id);
  if (ids.length) {
    for (const lnk of [
      'up_users_role_lnk',
      'courses_instructor_lnk',
      'blog_posts_author_lnk',
      'up_users_blocked_by_lnk',
    ]) {
      try {
        await knex(lnk).whereIn('user_id', ids).del();
      } catch {
        /* table shape differs — the FK cascade on user delete covers it */
      }
    }
    await knex('up_users').whereIn('id', ids).del();
  }
  strapi.log.info(`[reset] deleted ${ids.length} generated users`);

  // Reset demo-account blocked state so the seed re-applies it.
  await knex('up_users')
    .where('email', 'like', '%@lernexa.test')
    .update({ blocked: false, blocked_reason: null, blocked_at: null });
  strapi.log.info('[reset] cleared blocked flag on demo accounts');

  strapi.log.info('[reset] done — now run `npm run seed`.');
  return { aborted: false };
}

(async () => {
  const app = await createStrapi(await compileStrapi({ ignoreDiagnostics: true })).load();
  let failed = false;
  try {
    const res = await run(app);
    failed = Boolean(res?.aborted);
  } catch (err) {
    app.log.error(err);
    failed = true;
  } finally {
    await app.destroy().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
})();
