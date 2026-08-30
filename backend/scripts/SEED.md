# Seed — `npm run seed`

An **idempotent** development seed that builds a large, realistic dataset around
the six demo accounts, so the app behaves like it holds real content and every
list / dashboard / filter has enough data to be exercised honestly.

```bash
cd backend
npm run seed                 # build or top up the dataset (safe to repeat)
SEED_SCALE=min npm run seed   # ~1/6 the size — quick local check / CI
npm run seed:reset            # wipe seeded data (local DB only) then re-seed
```

Every seeded account has the password **`Lernexa123!`**.

---

## What it creates (SEED_SCALE=full)

| Entity | Count | Variety built in |
|---|---:|---|
| **Users** | ~97 | 2 admin, 3 content-manager, 12 instructor, ~80 student. ~7 blocked (varied reasons + block dates). ~35% have an avatar URL. Two instructors deliberately own **no** courses. |
| **Courses** | ~61 | Real titles/descriptions across ~30 topics. Ownership spread unevenly over the 12 instructors + 3 on managers. **4 courses have 0 lessons** (hidden from the public catalogue by rule 1, visible on the worklist / attention queue). ~9 have **0 enrolments**. 3–4 "popular" courses carry 30–45 students. One course has a deliberately overlong title + description. ~60% have a `coverImageUrl`. **Visibility (D-039):** every seeded course is `published` by default — populate `DRAFT_COURSE_TITLES` / `ENROLLED_ONLY_COURSE_TITLES` in `seed.js` to bring back the `draft` / `enrolled_only` demo fixtures. |
| **Lessons** | ~356 | 0–12 per course. Content is templated educational prose with **varied length** (1–4 paragraphs). A few courses have **gaps in `order`** (2, 4, 5, 7 …) — allowed by the data model. ~30% have a `videoUrl`. **Every seeded lesson is `published`** — flip `isHiddenLesson` in `seed.js` to bring back the hidden-lesson fixture. |
| **Quizzes** | 16 | 3–6 questions, 2–4 options each, options shuffled so the correct one isn't always first. **Exactly one** quiz (*Regular Expressions Deep Dive*) has a question with **no correct option** — this feeds the admin attention queue ("quizzes with no correct answer"). *React Fundamentals* keeps its documented 5-question checkpoint. **Every seeded quiz is `published`** — add titles to `HIDDEN_QUIZ_COURSE_TITLES` in `seed.js` to bring back the hidden-quiz fixture. |
| **Enrolments** | ~220 | `enrolledAt` spread over ~6 months; ~16% within the last week. Every progress state is represented (see below). 2 students are enrolled in a **0-lesson course** (dashboard "this course has no lessons yet" branch). |
| **Lesson completions** | ~900 | Contiguous from lesson 1 (realistic sequential learning). Timestamps increase between `enrolledAt` and now. ~1 in 6 partial learners has activity in the **last few days** (drives "active in last 7 days"). |
| **Quiz attempts** | ~35 | Varied scores 0–total. ~30% are retakes, and the retake is usually better. `answers` is a snapshot in the `[{ questionId, selectedOptionId, correct }]` shape. |
| **Blog posts** | 40 | 33 published (spread over ~1 year), 7 drafts — ~5 of them **older than a week** (feeds the content worklist "stale drafts"). Authors cycle over the managers + two instructors. |
| **Audit-log entries** | ~83 | `user.registered`, `user.role_changed`, `user.blocked` / `unblocked`, `settings.updated`, `course.created` / `deleted`, `blog.published` / `unpublished` / `deleted`, `account.password_changed` — `createdAt` spread over ~110 days. `course.unpublished` and `lesson.*` / `quiz.*` publish rows appear once those toggles are used in the running app. |

### Progress spread across enrolments

Roughly: **16%** not started (0%), **60%** partial (varied), **22%** almost done,
**~15%** complete (100%). Plus:

- students with **no enrolments** (~17)
- students with exactly **one** enrolment
- students enrolled in **4–8** courses (~29)
- courses that are **fully complete** for some students and **untouched** by others

### The six demo accounts are untouched by the bulk generator

`student@` and `blocked@` never get random enrolments/attempts. `student@` keeps
exactly the documented story: enrolled in **React Fundamentals**, **2 of 4**
lessons complete, **one** quiz attempt (3/4). This keeps the demo predictable.

---

## Why it's safe to run repeatedly

Each entity has a deterministic identity; the seed checks before it writes.

| Entity | Idempotency key |
|---|---|
| users | `email` |
| courses | `title` (a re-run also reconciles `lessonProgression` + `status`) |
| lessons | created only when the course currently has **0** (the `published` flag is set on create, not reconciled) |
| quizzes | created only when the course currently has **0** (same — `published` set on create only) |
| enrolments | unique `dedupeKey` = `"<userId>:<courseId>"` |
| lesson completions | unique `dedupeKey` = `"<userId>:<lessonId>"` |
| blog posts | `title` |
| quiz attempts | skipped when the `(student, quiz)` pair already has one |
| audit-log entries | deterministic `metadata.seedId`, checked before insert |

All "random" choices come from a **seeded PRNG keyed on stable identifiers**
(email, title, …), so a re-run makes the same decisions. A second consecutive
run reports **all-zero** deltas.

### The one caveat — use `seed:reset` after changing the script

Idempotency holds for a **fixed** `seed.js`. If you change the set of generated
users (or their order), the per-user dedupe keys change and a re-run **layers a
second dataset on top of the first** instead of updating it. When that happens:

```bash
npm run seed:reset && npm run seed
```

`seed:reset` truncates the seeded content tables, deletes every `@lernexa.dev`
user, and clears the demo accounts' blocked flag — then `seed` rebuilds from a
clean slate. It refuses to run unless the database looks local (`localhost` /
sqlite); pass `-- --force` to override.

---

## Post-seed self-check

`seed.js` ends by running `verify()` against the **real query paths** and logging
a report, e.g.:

```
[seed:verify] catalogue: 57 visible courses, page 1 has 12 (pageCount 5) — pagination is exercisable: YES
[seed:verify] users: total 99, 5 pages @20; page1[0]=admin@lernexa.test page2[0]=felix.bauer@lernexa.dev — differ: YES
[seed:verify] progress spread: 35 not-started, 134 partial, 50 complete (across 219 enrolments)
[seed:verify] instructors: 12 total, 2 with 0 courses, busiest owns 15
[seed:verify] quizzes: 16 total, 1 with an unanswerable question (expected: 1)
[seed:verify] blog: 40 posts — 33 published, 7 draft (5 stale >7d); anonymous /api/blog-posts returns 33
[seed:verify] audit: 83 entries, 4 pages @25; ...
```

It checks: catalogue pagination, admin user-list pages 1≠2, search / role / status
filters incl. an empty result, the busiest course's `student-progress`, the
not-started/partial/complete spread, students with 0 enrolments, instructors with
0 courses, the unanswerable-question quiz count, blog draft/published/stale
counts, and audit-log pagination + date span.

---

## What this dataset is for

It is sized to make real problems visible — the kind that don't show up with
three courses and four users:

| Area | What the data exercises |
|---|---|
| **Pagination** | 61 courses (catalogue page cap is 48), 97 users (5 pages @20), 83 audit rows (4 pages @25), 40 blog posts (default page 25). First page ≠ later pages; sort/filter/search all have enough rows to matter; empty results are reachable (`?q=zzzznotreal`). |
| **Dashboards** | Instructor with many courses vs. two with none; students with 0 / 1 / many enrolments; partially- and fully-complete courses; recent vs. old activity; the admin attention queue is non-empty (1 broken quiz, 4 empty courses, 7 blocked users). |
| **Relationships** | Courses across 12 owners; enrolments and completions fan out per course; quizzes on a subset; blog authorship across 6 people. |
| **Performance / N+1** | A course with ~40 students in `student-progress` (the batched 2-query path); the instructor home fanning `getStudentProgress` across every "owned" course. |
| **Large responses** | Long lesson `content`, ~60 courses in one catalogue payload, big user pages. |
| **Empty states** | Students with no enrolments, courses with no students, instructors with no courses, an enrolment in a 0-lesson course. |

### Observations surfaced while verifying (not fixed here — they're app logic)

- **Instructor "my courses" scoping is ineffective.** `listManagedCourses(mineId)`
  sends `filters[instructor][id][$eq]`, but the course `find` controller passes
  the caller's filters through `sanitizeQuery`, which **strips** a filter that
  traverses `plugin::users-permissions.user` (instructors have no read grant on
  it). Result: an instructor's `/manage/courses` and `/manage` dashboard see
  **every** course on the platform, capped at the `pageSize=48` fetch. With the
  old 3-course seed this was nearly invisible; with 61 it is obvious. Fix belongs
  in the controller (force `instructor = ctx.state.user.id` for the instructor
  role, like `create` already does) or a dedicated endpoint.
- **Client-capped list fetches with no page controls.** `listCatalogue`,
  `listManagedCourses`, `listManagedPosts` fetch a single fixed page
  (`pageSize` 48 / 25) and render everything returned — later pages are
  unreachable from the UI. The dataset makes each of these overflow.
