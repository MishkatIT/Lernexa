# DATA_MODEL.md — Lernexa

**Supersedes v1.** Adds: user blocking metadata, `SiteSettings` single type, `AuditLog`,
and index justifications.

## Core principle

**Store facts. Derive metrics.**

Progress percentage is never stored. It is computed from completion rows. A stored
percentage is (a) a field a client will try to write and (b) stale the moment a lesson
is added or removed.

## Entity map

```
User ──1:N── Course (as instructor/owner)
User ──1:N── Enrollment ──N:1── Course
User ──1:N── LessonCompletion ──N:1── Lesson
User ──1:N── QuizAttempt ──N:1── Quiz
User ──1:N── BlogPost (as author)
User ──1:N── AuditLog (as actor)

Course ──1:N── Lesson
Course ──1:N── Quiz

SiteSettings  (Strapi Single Type — exactly one row)
```

## Roles

Created in `src/index.ts` `bootstrap()` so they exist on a fresh deploy:
`admin`, `content-manager`, `instructor`, `student`.

> **Naming caution.** These are *application* roles on end users (Users & Permissions
> plugin). They are **not** Strapi admin-panel accounts. Nobody logs into the Strapi
> backoffice to use Lernexa. The spec's "Admin Panel" is a page you build in Next.js.
> Conflating these is a common and visible mistake — be able to state the difference.

## User (extends `plugin::users-permissions.user`)

Built-in: `username`, `email`, `password`, `confirmed`, `blocked`, `role`.

Add:
| field | type | notes |
|---|---|---|
| `fullName` | string | display name |
| `avatarUrl` | text | profile photo — an http(s) URL or a client-resized image data URL (~256px); self-service via `PUT /api/users/me` |
| `blockedReason` | text | why, shown to admins and to the blocked user |
| `blockedAt` | datetime | |
| `blockedBy` | relation N:1 → User | who did it |
| `courses` | 1:N → Course | owned as instructor |
| `enrollments` | 1:N → Enrollment | |

### Blocking — one state, not two

**Decision:** a single `blocked` boolean (Strapi's built-in) plus reason metadata.
Rejected: separate `suspended` and `blocked` states. They would share one enforcement
path and one UI; two names for one behaviour is complexity without product value.

**Why `blocked` and not a custom enum:** Strapi's login callback already checks
`user.blocked === true` and rejects with "Your account has been blocked by an
administrator". Reusing the built-in field means the login path is covered for free.

**The part that is NOT free — and the reason this feature is worth building:**

A JWT is stateless. Blocking a user writes a row in the database; it does not reach
into their browser and revoke the token they already hold. Unless something re-checks
account state on **every authenticated request**, a blocked user keeps working until
their token expires.

> **VERIFY THIS EMPIRICALLY BEFORE RELYING ON EITHER ANSWER.** I confirmed Strapi
> checks `blocked` at the *login* endpoint. I could **not** confirm whether the
> per-request authentication strategy re-checks it. Test it: block a user, replay their
> existing token against a protected endpoint, observe. Whichever way it goes, you now
> have a real finding for the video — which beats a guess.

If it does not re-check, add a global middleware that does. See RBAC.md.

### Registration hardening

Public register must always create a `student` and must ignore any `role` in the body —
accepting one is direct privilege escalation.

Don't rely on `sanitizeInput` alone: there is a known Strapi issue (strapi/strapi#25204)
where undeclared fields can survive sanitization. Add an explicit zod/yup allowlist on
the payload as a second layer.

## Course

| field | type | notes |
|---|---|---|
| `title` | string, required | |
| `slug` | uid (from title) | |
| `description` | text | |
| `coverImageUrl` | string | URL only, no upload plugin |
| `lessonProgression` | enum `free` \| `complete_locked` \| `open_locked`, required, default `free` | D-038 — how students move through lessons |
| `instructor` | relation N:1 → User | **the ownership anchor** |
| `lessons` | 1:N → Lesson | |
| `quizzes` | 1:N → Quiz | |
| `enrollments` | 1:N → Enrollment | |

`instructor` anchors ownership for the whole tree — lesson, quiz, and progress
visibility all resolve through `→ course → instructor`.

`lessonProgression` (D-038) is enforced server-side by pure helpers in
`lesson-completion/services/progression.ts`: `free` = no restriction,
`complete_locked` = a lesson can't be completed until every earlier lesson is,
`open_locked` = a lesson can't be opened until every earlier lesson is. "Earlier"
is the course's own `order ASC, id ASC`. Unknown/null normalises to `free`, so
existing courses are unaffected.

**Do not rely on Strapi's built-in `createdBy`.** It is populated for admin-panel
creates, not reliably for Content API creates. You need an explicit relation.

Who is set on create:
- Instructor creates → `instructor = ctx.state.user.id`, **forced server-side**, body ignored
- Content Manager / Admin creates → may set `instructor` explicitly

## Lesson

| field | type | notes |
|---|---|---|
| `title` | string, required | |
| `content` | richtext or text | spec: text **or** video URL |
| `videoUrl` | string | optional |
| `order` | integer, required | sequence within course |
| `course` | N:1 → Course, required | |

Sequential viewing sorts by `order ASC, id ASC`. Gaps in `order` are allowed —
simplest thing that works, and honest.

## Enrollment

| field | type | notes |
|---|---|---|
| `student` | N:1 → User, required | |
| `course` | N:1 → Course, required | |
| `enrolledAt` | datetime | |

**Unique on (student, course)**, enforced twice:
1. Controller checks before create and returns the existing row — idempotent enroll,
   double-click is not an error
2. DB unique index via migration — **this is the actual guarantee**; the controller
   check is a read-then-write race

Being able to explain why *both* is a strong interview moment.

## LessonCompletion

This is the progress system. There is no `Progress` table and no percentage column.

| field | type | notes |
|---|---|---|
| `student` | N:1 → User, required | |
| `lesson` | N:1 → Lesson, required | |
| `course` | N:1 → Course | **denormalised** — enables per-course progress without a join |
| `completedAt` | datetime | |

- Unique on (student, lesson), same two-layer approach
- Marking complete requires an active Enrollment for that course
- Un-marking = delete the row
- `course` is set server-side from `lesson.course` — never from the request

### computeProgress

```
total     = count(lessons where course = C)
completed = count(lessonCompletions where student = S and course = C)
percent   = total === 0 ? 0 : round(completed / total * 100)
```

Edge cases to handle and be ready to discuss:
- `total === 0` → return 0, do not divide by zero
- Instructor adds a 6th lesson to a course a student had at 5/5 → student drops to 83%.
  **This is correct** — the course changed. Say this deliberately in the video; a
  reviewer may probe whether you reasoned about it or got lucky.
- Lesson deleted → completions must cascade, or `completed` can exceed `total`. Verify
  Strapi's relation-delete behaviour for your version; add explicit cleanup if it
  doesn't cascade.
- Unenroll → keep completions (re-enrolling restores progress). Simpler and friendlier.

### Batched variant — see PERFORMANCE.md

`computeProgress` is for one student. The instructor's student-progress table must
**never** call it in a loop. Use `computeProgressForCourse(courseId)` — two queries for
all students. This is the single most valuable performance demo in the project.

## Quiz

| field | type |
|---|---|
| `title` | string, required |
| `course` | N:1 → Course, required |
| `questions` | repeatable component `quiz.question` |

**Component `quiz.question`:** `prompt` (text, required), `options` (repeatable
`quiz.option`, min 2)

**Component `quiz.option`:** `text` (string, required), `isCorrect` (boolean, default false)

**Why `isCorrect` on the option, not `correctIndex` on the question:** the student
submits an option **id**, not a position. Positions shift when a quiz is edited; ids
don't. It also extends to multi-answer without a migration.

### The critical security constraint

`isCorrect` must never reach a student's browser — not in JSON, not in a hidden field,
**not in the Next.js RSC payload** (which is visible in page source).

Defence, in three parts:
1. **Disable `find` and `findOne` on Quiz entirely for the student role.** The raw
   endpoint does not exist for them.
2. Expose only `GET /api/quizzes/:id/take`, backed by `toStudentQuiz(quiz)` — an
   explicit field mapping to `{ id, prompt, options: [{ id, text }] }`. Explicit
   construction can only contain what it names; deleting fields from a populated object
   is fragile.
3. Never pass a populated quiz into a client component. Map it in the Server Component.

## QuizAttempt

| field | type | notes |
|---|---|---|
| `student` | N:1 → User, required | |
| `quiz` | N:1 → Quiz, required | |
| `score` | integer | number correct |
| `totalQuestions` | integer | **snapshot at submit time** |
| `answers` | json | `[{ questionId, selectedOptionId, correct }]` |
| `submittedAt` | datetime | |

**Why snapshot rather than recompute on read:** an attempt is a historical record. If
an instructor edits the quiz next week, a student's stored result must not silently
change. That's an immutability argument, and it's exactly the reasoning that separates
a strong candidate from an average one.

Retakes: allowed, all attempts stored, show latest + best. If short on time, single
attempt — **documented as a decision**, not left as an omission.

## BlogPost

| field | type |
|---|---|
| `title` | string, required |
| `slug` | uid |
| `body` | richtext or text |
| `coverImageUrl` | string |
| `author` | N:1 → User |

**Use Strapi's native Draft & Publish**, not a hand-rolled `status` enum. The hiring
team works in Strapi daily; reimplementing a first-class feature signals not knowing
the tool.

> **Verify:** Strapi 5 returns published entries by default and uses a `status`
> parameter for drafts (v4 used `publicationState`). Confirm the exact parameter for
> your installed version, then **test it from an anonymous session** — hit the blog
> list logged out and confirm zero drafts.

Fallback if native D&P costs more than ~45 minutes: `status` enum + controller-forced
filter, recorded in DECISIONS.md with the reason. A documented fallback is fine; an
undocumented reinvention is not.

## SiteSettings — Strapi **Single Type** (Tier 3)

You asked for "a typed configuration model, not an arbitrary key/value table."
**Strapi Single Types are exactly that** — one row, schema-validated, typed. Using the
built-in is the answer; a `settings` KV table would be the anti-pattern.

| field | type | notes |
|---|---|---|
| `siteName` | string, default "Lernexa" | browser title, header |
| `registrationEnabled` | boolean, default true | gates public signup |

**Scope reduced in v3 (D-026).** The banner group (`bannerEnabled`, `bannerMessage`,
`bannerSeverity`, `bannerLinkUrl`, `bannerLinkLabel`, `bannerDismissible`) moved to
Tier 4 — ~3h for "an admin can display a message." `registrationEnabled` stays because
it's 20 minutes and a strong video beat: disable it in the panel, curl the register
endpoint on camera, get a 403.

Deliberately **not** included: logo/favicon upload (ephemeral filesystem), site
description, support contact — settings that nothing reads.

**Read path:** public `find` allowed (the banner must render for logged-out users), but
`update` is admin-only. Cached in Next.js with tag `site-settings`, invalidated by
`revalidateTag` on update. See PERFORMANCE.md.

**Banner dismissal:** store the dismissal keyed by the settings `updatedAt` in a cookie
(not localStorage — a cookie is readable during SSR, so there's no flash of a
banner the user already dismissed). A new banner reappears because the key changed.

## AuditLog (Tier 3)

Append-only. **No update or delete endpoints exist — not even for admin.** An audit log
an admin can edit is not an audit log. That immutability argument is the whole point of
building it.

| field | type | notes |
|---|---|---|
| `actor` | N:1 → User | who did it |
| `action` | enum | `role.changed`, `user.blocked`, `user.unblocked`, `settings.updated`, `blog.published`, `course.deleted` |
| `targetType` | string | `user`, `course`, `blog-post`, `settings` |
| `targetId` | string | |
| `targetLabel` | string | denormalised human-readable label, so the log stays readable after the target is deleted |
| `metadata` | json | `{ from: 'student', to: 'instructor' }` |
| `createdAt` | datetime | Strapi built-in |

`targetLabel` denormalisation is deliberate: "Role changed for user 47" is useless once
user 47 is gone. Small, defensible decision.

Written from a single service, `audit.record(...)`, called by admin controllers. Not a
middleware — explicit call sites are easier to reason about and to show in the video.

## Indexes — justified by query pattern

Add only these. Each maps to a real query.

| Index | Query it serves |
|---|---|
| `enrollment(student, course)` UNIQUE | enroll idempotency + "My Courses" |
| `lesson_completion(student, lesson)` UNIQUE | mark-complete idempotency |
| `lesson_completion(course, student)` | **the hot path** — progress computation, batched and single |
| `lesson(course, order)` | ordered lesson fetch for the viewer |
| `quiz_attempt(student, quiz)` | attempt history |
| `blog_post(slug)` | public post lookup |
| `audit_log(created_at DESC)` | recent-activity list |

Not added, and why: no index on `course.title` (no search at this scale), none on
`user.email` (Strapi already has one), none on boolean columns (low cardinality,
the planner will ignore them).

> **Warning before you write the migration.** Strapi 5 stores relations in generated
> **link tables** (e.g. `enrollments_student_lnk`), so these indexes belong on link-table
> columns, not on the entity tables. The naming is version-specific. **Inspect your
> actual generated schema first** — do not copy index definitions from this document or
> any other.

## Deletion policy — guards, not soft delete

**There is no `deletedAt` anywhere.** Soft delete would require a `deletedAt: null`
filter on every query in the system, and it would collide with the forced-ownership
filters (RBAC layer 4) — two forced filters per controller override instead of one,
doubling the surface where a spread-order mistake leaks data. See D-020.

Instead, destructive operations **refuse** when they would orphan data:

| Operation | Guard | Response |
|---|---|---|
| `DELETE /api/courses/:id` | enrollments exist | **409** `"Cannot delete 'React Basics' — 23 students are enrolled."` |
| `DELETE /api/lessons/:id` | completions exist | **409** with the completion count |
| `DELETE /api/quizzes/:id` | attempts exist | **409** with the attempt count |
| `DELETE` user | not implemented at all | see D-019 |

409 Conflict, not 422: the conflict is with resource state, not payload validity. Be
ready to defend that choice — either is arguable.

The delete confirmation modal shows the dependent count *before* the attempt, so the 409
is a backstop rather than the normal path. **Both layers exist on purpose:** the modal is
UX, the 409 is the rule. This is the same pattern as the block guards.

## Catalogue visibility rules

The public course list is server-filtered:

1. **Only a `published` course is listed** (D-039). Since D-040 this is the *only*
   catalogue gate — a published course with zero lessons and no quiz still shows.
   Publishing is an explicit owner action, so it carries the intent to list;
   content-readiness is surfaced as work-to-do in the manage worklist and admin
   attention queue, not enforced as a hidden publish precondition.
2. Already-enrolled students see "Continue", not "Enroll" (see DESIGN_SYSTEM.md screen 6).

The earlier "zero-lesson courses are filtered out" heuristic (a relation filter, no
`published` flag) was replaced by the explicit `status` field in D-039 and fully
retired in D-040.

## Data integrity checks

Surfaced in the admin attention queue. Each is one count query. These check the
invariants the data model claims to hold:

| Check | Why it matters |
|---|---|
| Courses with zero lessons | Listed if published (D-040), but a shell course is work-to-do the author should know about |
| **Quizzes where no option is marked correct** | **Real bug** — every student silently scores zero on that question |
| Blog drafts older than 7 days | Stalled content pipeline |
| Blocked users | Moderation load |

The quiz check is the valuable one: it's a data state that produces silently wrong
grading with no error anywhere. Catching it demonstrates thinking about invariants rather
than just happy paths.

## Custom endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/local/register` | public | forced student role; gated by `registrationEnabled` |
| POST | `/api/auth/local` | public | login |
| GET | `/api/users/me?populate=role` | authed | current user + role |
| PUT | `/api/users/me` | authed | self-service profile — `{ fullName?, avatarUrl? }` only, partial; role/email/blocked untouchable |
| POST | `/api/auth/change-password` | authed | built-in Strapi; rotates the session JWT |
| POST | `/api/enrollments/enroll` | student | `{ courseId }`, idempotent |
| GET | `/api/enrollments/me` | student | own only, forced filter |
| **GET** | **`/api/courses/:id/learn`** | enrolled student | **course + ordered lessons + own completions + next lesson, one round trip** |
| POST | `/api/lesson-completions/complete` | student | `{ lessonId }` |
| DELETE | `/api/lesson-completions/:lessonId` | student | un-complete |
| GET | `/api/courses/:id/student-progress` | admin/CM/owner | **batched** — 2 queries for all students |
| GET | `/api/quizzes/:id/take` | enrolled student | sanitised, no `isCorrect` |
| POST | `/api/quizzes/:id/submit` | enrolled student | graded server-side |
| GET | `/api/quiz-attempts/me` | student | own only, forced filter |
| GET | `/api/platform/users` | admin | paginated, searchable, role/status filters |
| PUT | `/api/platform/users/:id/role` | admin | with all guards |
| PUT | `/api/platform/users/:id/block` | admin | `{ blocked, reason }` |
| GET | `/api/platform/stats` | admin | parallel aggregates, cached |
| GET | `/api/platform/audit` | admin | paginated, newest first |
| GET/PUT | `/api/site-settings` | public read / admin write | Single Type |

## Seed (`npm run seed`) — idempotent

Full reference: **[`backend/scripts/SEED.md`](../backend/scripts/SEED.md)**.

**The six anchor accounts** (unchanged — the demo depends on them):

- one per role: `admin@lernexa.test`, `cm@lernexa.test`, `instructor@lernexa.test`
- **2nd instructor** (`instructor2@lernexa.test`) owning different courses — makes the
  cross-instructor 403 demoable. **Do not skip it.**
- **blocked user** (`blocked@lernexa.test`) so the blocked-login state is demoable
  without breaking a working account mid-video.
- `student@lernexa.test` pre-enrolled in **React Fundamentals**, 2 of 4 lessons
  complete, one quiz attempt — progress shows a real, non-zero, non-100% number on
  first load. The bulk generator never touches this account.

**The dataset built around them** (`SEED_SCALE=full`, the default):

- ~97 users (2 admin / 3 CM / 12 instructor / ~80 student), ~7 blocked, 2 instructors
  who own nothing
- ~61 courses across ~30 topics, spread unevenly over the instructors; **4 with no
  lessons**, ~9 with no enrolments, 3–4 with 30–45 students
- ~356 lessons (0–12 per course, varied length, some with `order` gaps)
- 16 quizzes — **exactly one** has a question with no correct option (the attention-queue
  check); React Fundamentals keeps its 5-question checkpoint
- ~220 enrolments spanning every progress state; ~900 lesson completions; ~35 quiz
  attempts (some retakes)
- 40 blog posts — 33 published over ~1 year, 7 drafts (~5 older than a week)
- ~83 audit-log entries covering every action, spread over ~110 days

Everything keys off a deterministic identifier or a seeded PRNG, so a re-run is a
near-no-op. After **changing** the script, run `npm run seed:reset` first (it only
touches a local DB) — otherwise a re-run layers a second dataset on top. `seed.js`
finishes with a `verify()` pass that checks the data against the real query paths.

`SEED_SCALE=min` produces ~1/6 the volume for a fast local check or CI.

A reviewer who opens the Vercel URL and sees an empty app with a signup form spends
ninety seconds and moves on. **Demo credentials in the README are the highest
return-on-effort item in the project.**
