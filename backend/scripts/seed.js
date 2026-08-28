'use strict';

/**
 * Idempotent seed — `npm run seed`. Safe to run repeatedly (against local or
 * production). Everything is checked before it's created.
 *
 * Produces (docs/DATA_MODEL.md "Seed"):
 *  - one user per role, plus instructor2 and a blocked user
 *  - 3 courses (2 owned by instructor, 1 by instructor2), 4 lessons each
 *  - 1 quiz with 5 questions on the first course
 *  - 1 published blog post + 1 draft
 *  - student pre-enrolled in course 1 with 2 of 4 lessons complete
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi');

const PASSWORD = 'Lernexa123!';

const USERS = [
  { email: 'admin@lernexa.test', fullName: 'Ada Admin', role: 'admin' },
  { email: 'cm@lernexa.test', fullName: 'Cy Manager', role: 'content-manager' },
  { email: 'instructor@lernexa.test', fullName: 'Ivy Instructor', role: 'instructor' },
  { email: 'instructor2@lernexa.test', fullName: 'Ike Instructor', role: 'instructor' },
  { email: 'student@lernexa.test', fullName: 'Sam Student', role: 'student' },
  {
    email: 'blocked@lernexa.test',
    fullName: 'Bo Blocked',
    role: 'student',
    blocked: true,
    blockedReason: 'Seeded as a blocked account for the demo.',
  },
];

const COURSES = [
  {
    title: 'React Fundamentals',
    owner: 'instructor@lernexa.test',
    description: 'Components, props, state and the render cycle.',
    lessons: [
      'Why components',
      'Props and composition',
      'State and events',
      'Lists and keys',
    ],
    quiz: {
      title: 'React Fundamentals — checkpoint',
      questions: [
        {
          prompt: 'What triggers a re-render?',
          options: [
            { text: 'A state or prop change', isCorrect: true },
            { text: 'Editing the CSS file', isCorrect: false },
          ],
        },
        {
          prompt: 'Props flow…',
          options: [
            { text: 'Parent to child', isCorrect: true },
            { text: 'Child to parent', isCorrect: false },
          ],
        },
        {
          prompt: 'Keys in a list should be…',
          options: [
            { text: 'Stable and unique', isCorrect: true },
            { text: 'The array index, always', isCorrect: false },
          ],
        },
        {
          prompt: 'useState returns…',
          options: [
            { text: 'A value and a setter', isCorrect: true },
            { text: 'Only a value', isCorrect: false },
          ],
        },
        {
          prompt: 'JSX is…',
          options: [
            { text: 'Syntax sugar for function calls', isCorrect: true },
            { text: 'A separate templating language at runtime', isCorrect: false },
          ],
        },
      ],
    },
  },
  {
    title: 'TypeScript for Teams',
    owner: 'instructor@lernexa.test',
    description: 'Types that document intent without getting in the way.',
    lessons: ['Structural typing', 'Narrowing', 'Generics in practice', 'Config that scales'],
  },
  {
    title: 'API Design Basics',
    owner: 'instructor2@lernexa.test',
    description: 'Designing endpoints people can use without reading the source.',
    lessons: ['Resources and verbs', 'Errors that help', 'Pagination', 'Versioning'],
  },
];

const BLOG = [
  {
    title: 'Welcome to Lernexa',
    body: 'Lernexa leads with where you are, not with a wall of courses. Enrol, and your dashboard resumes you at the next lesson.',
    publish: true,
  },
  {
    title: 'Draft: the roadmap',
    body: 'This post is a draft and should never be visible to a logged-out visitor.',
    publish: false,
  },
];

async function run(strapi) {
  const q = (uid) => strapi.db.query(uid);
  const userService = strapi.plugin('users-permissions').service('user');

  const roles = {};
  for (const type of ['admin', 'content-manager', 'instructor', 'student']) {
    roles[type] = await q('plugin::users-permissions.role').findOne({ where: { type } });
  }

  // --- users ---
  const byEmail = {};
  for (const u of USERS) {
    let user = await q('plugin::users-permissions.user').findOne({ where: { email: u.email } });
    if (!user) {
      user = await userService.add({
        username: u.email,
        email: u.email,
        password: PASSWORD,
        confirmed: true,
        provider: 'local',
        role: roles[u.role].id,
        fullName: u.fullName,
      });
      strapi.log.info(`[seed] user ${u.email}`);
    }
    if (u.blocked && !user.blocked) {
      await q('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { blocked: true, blockedReason: u.blockedReason, blockedAt: new Date() },
      });
      strapi.log.info(`[seed] blocked ${u.email}`);
    }
    byEmail[u.email] = user;
  }

  // --- courses + lessons + quiz ---
  const courseByTitle = {};
  for (const c of COURSES) {
    let course = await q('api::course.course').findOne({ where: { title: c.title } });
    if (!course) {
      course = await q('api::course.course').create({
        data: {
          title: c.title,
          slug: c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          description: c.description,
          instructor: byEmail[c.owner].id,
          publishedAt: new Date(),
        },
      });
      strapi.log.info(`[seed] course ${c.title}`);
    }
    courseByTitle[c.title] = course;

    const existingLessons = await q('api::lesson.lesson').count({
      where: { course: { id: course.id } },
    });
    if (existingLessons === 0) {
      let order = 1;
      for (const title of c.lessons) {
        await q('api::lesson.lesson').create({
          data: {
            title,
            order: order++,
            content: `${title}.\n\nThis is seeded lesson content for the demo.`,
            course: course.id,
            publishedAt: new Date(),
          },
        });
      }
      strapi.log.info(`[seed] ${c.lessons.length} lessons for ${c.title}`);
    }

    if (c.quiz) {
      const hasQuiz = await q('api::quiz.quiz').count({ where: { course: { id: course.id } } });
      if (hasQuiz === 0) {
        // document service handles nested components correctly
        await strapi.documents('api::quiz.quiz').create({
          data: {
            title: c.quiz.title,
            course: course.documentId,
            questions: c.quiz.questions,
          },
          status: 'published',
        });
        strapi.log.info(`[seed] quiz for ${c.title}`);
      }
    }
  }

  // --- student pre-enrolled in course 1, 2 of 4 lessons done ---
  const student = byEmail['student@lernexa.test'];
  const course1 = courseByTitle['React Fundamentals'];
  const enrolKey = `${student.id}:${course1.id}`;
  let enrol = await q('api::enrollment.enrollment').findOne({ where: { dedupeKey: enrolKey } });
  if (!enrol) {
    enrol = await q('api::enrollment.enrollment').create({
      data: {
        student: student.id,
        course: course1.id,
        enrolledAt: new Date(),
        dedupeKey: enrolKey,
        publishedAt: new Date(),
      },
    });
    strapi.log.info('[seed] enrolled student in React Fundamentals');
  }
  const firstTwo = await q('api::lesson.lesson').findMany({
    where: { course: { id: course1.id } },
    orderBy: { order: 'asc' },
    limit: 2,
  });
  for (const lesson of firstTwo) {
    const key = `${student.id}:${lesson.id}`;
    const done = await q('api::lesson-completion.lesson-completion').findOne({
      where: { dedupeKey: key },
    });
    if (!done) {
      await q('api::lesson-completion.lesson-completion').create({
        data: {
          student: student.id,
          lesson: lesson.id,
          course: course1.id,
          completedAt: new Date(),
          dedupeKey: key,
          publishedAt: new Date(),
        },
      });
    }
  }
  strapi.log.info('[seed] 2 lesson completions for student');

  // --- blog ---
  const cm = byEmail['cm@lernexa.test'];
  for (const b of BLOG) {
    const existing = await q('api::blog-post.blog-post').findOne({ where: { title: b.title } });
    if (existing) continue;
    await strapi.documents('api::blog-post.blog-post').create({
      data: {
        title: b.title,
        slug: b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        body: b.body,
        author: cm.id,
      },
      status: b.publish ? 'published' : 'draft',
    });
    strapi.log.info(`[seed] blog "${b.title}" (${b.publish ? 'published' : 'draft'})`);
  }

  strapi.log.info('[seed] done. Password for every seeded account: ' + PASSWORD);
}

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  let failed = false;
  try {
    await run(app);
  } catch (err) {
    app.log.error(err);
    failed = true;
  } finally {
    // destroy() can throw a benign "aborted" while draining the pool — ignore it.
    await app.destroy().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
})();
