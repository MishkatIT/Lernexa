# DECISIONS.md — Lernexa

Architecture decision records. Each should be defensible out loud, **including the case
against it**. Keep this in the repo — a reviewer learns more from it in two minutes than
from a thousand lines of code.

---

### D-001 — Monorepo, two folders, no tooling
One repo, `frontend/` + `backend/`. The form asks for one link; both hosts support a root
directory. **Tradeoff:** no shared type package, so types are duplicated. Cheaper than
build complexity at this size.

### D-002 — httpOnly cookie session, not localStorage
Next.js route handler exchanges credentials with Strapi and stores the JWT in an
`httpOnly; Secure; SameSite=Lax` cookie. **Why:** a token in localStorage turns any XSS
into full account takeover; httpOnly removes the class entirely and is what lets Server
Components authenticate. **Tradeoff:** reintroduces CSRF (mitigated by SameSite=Lax +
POST-only Server Actions), and all traffic routes through Vercel. **Rejected:**
localStorage + client fetch — simpler, and what most tutorials show.

### D-003 — Progress derived, never stored
No `progress` column. `LessonCompletion` rows are the truth. **Why:** a stored percentage
is a field the client will try to write, and it goes stale the moment a lesson changes.
**Tradeoff:** two counts per read instead of one column. **Consequence accepted:** a
5/5 student drops to 5/6 when a lesson is added. Correct — the course changed.

### D-004 — `isCorrect` on the option; quiz `find` disabled for students
Students get only `/take`, built by explicit field mapping. **Why:** deleting fields from
a populated object is fragile — one `populate=*` and answers leak. Explicit construction
can only contain what it names. Option **id** is submitted, not index, because indices
shift when a quiz is edited. **Tradeoff:** two representations of a quiz. Worth it; the
shapes genuinely differ.

### D-005 — Ownership filters forced, not merged
List endpoints overwrite the ownership filter from `ctx.state.user` after
`sanitizeQuery`. **Why:** roles can't express "own rows only" and policies don't run on
collection queries. Strapi's CVE-2026-27886 was this exact class. **The detail:** the
forced filter must come **last** in the spread — order decides who wins. **Tradeoff:**
overriding core controllers means re-implementing sanitize/transform correctly by hand.

### D-006 — Native Strapi Draft & Publish for the blog
**Why:** first-class feature of the mandated CMS; reimplementing it signals not knowing
the tool. **Tradeoff:** couples to version-specific Content API behaviour (v5 `status`,
v4 `publicationState`). **Fallback:** if it costs >45 min, switch to a `status` enum with
a forced filter and record the switch here.

### D-007 — 403, not 404, for resources that exist but aren't yours
**Why:** simpler to reason about, unambiguous in the demo. **Tradeoff:** 403 confirms
existence — a small info leak. 404 would hide it. For an LMS where course titles are
public anyway, immaterial. **Know this tradeoff**; the right answer is context-dependent.

### D-008 — Public registration always creates a student
Role in the body is ignored. **Why:** accepting one from an unauthenticated request is
direct privilege escalation. **Note:** don't rely on `sanitizeInput` alone —
strapi/strapi#25204 means undeclared fields can survive. Add an explicit zod allowlist.

### D-009 — Uniqueness enforced twice
Controller check *and* a DB unique index. **Why:** the controller check makes the endpoint
idempotent and gives a clean double-click response; the DB index is the only thing that
holds under concurrency, because the controller check is a read-then-write race.
**Tradeoff:** a hand-written migration outside the content-type builder.

### D-010 — Test authorization, not components
Budget goes to a table-driven permission matrix and unit tests for `gradeQuiz` /
`computeProgress`. **Why:** the spec names access control and those two algorithms as
evaluation criteria. A component test asserting a heading renders catches nothing that
matters here. **Tradeoff:** no UI regression net. Stated in the README, not hidden.

---

## New in v2

### D-011 — Scope was cut, deliberately, against a longer wishlist
Maintenance mode, separate suspend/block states, admin logo upload, true active-user
tracking, and a 30-screen UI spec were all considered and **rejected**.

**Why:** with four days, breadth is the failure mode, not the goal. Fifteen features at
tutorial depth in a junior submission reads as AI output; five at production depth reads
as engineering. The 10-minute video makes this concrete — 15 features gets 40 seconds
each, which is exactly enough to sound rehearsed and not enough to sound understood.

**Tradeoff:** the feature list is shorter than it could have been. Accepted deliberately.
**This entry is itself part of the submission** — knowing what not to build is the
decision most worth showing.

### D-012 — One `blocked` state, not suspend + block
**Why:** two states would share one enforcement path and one UI. Two names for one
behaviour is complexity without product value. A single `blocked` flag with
`blockedReason` + audit trail covers every real case. **Rejected:** temporary suspension
with `suspendedUntil` — would need a scheduled job or a lazy check on read, for a feature
nobody would demo.

### D-013 — Per-request account-state revalidation
A global middleware re-checks `blocked` on every authenticated request.

**Why:** a JWT is stateless. Blocking writes a database row; it does not reach into the
user's browser. Without a per-request check, a blocked user keeps working until token
expiry. **Tradeoff:** one extra user read per authenticated request. Acceptable here; at
scale you'd cache blocked ids in Redis with a short TTL, or shorten token lifetime and
rely on refresh. **Open item:** verify empirically whether Strapi's per-request auth
strategy already does this — confirmed only for the *login* path.

**Empirical result (Strapi 5.52), Phase 6:** blocked a user, replayed their pre-block
token against `/api/users/me`. Without the middleware the request gets a bare **401** —
so 5.52's auth strategy *does* reject a blocked token, but generically. The
`global::account-state` middleware upgrades that to a **403 `ACCOUNT_BLOCKED` + reason**,
which is what lets the frontend route to `/account-blocked` and show the explanation.
The middleware earns its place for the *shape* of the rejection, not for closing an open
hole. Enforcement points: Strapi login callback (401), our middleware (403 + reason),
Next.js `getCurrentUser` catches it → redirect to `/account-blocked?reason=`, UI disables
self / last-admin actions and the controller re-checks (400).

### D-014 — Site settings as a Strapi Single Type, not a KV table
**Why:** Single Types are a typed, schema-validated, single-row config model — exactly
what's wanted, and built in. A `settings(key, value)` table would be untyped, unvalidated,
and a reinvention. **Tradeoff:** adding a setting means a schema change rather than a row
insert. Correct at this scale — settings should be reviewed, not created ad hoc.

### D-015 — Audit log is append-only, with no write API
No create/update/delete routes exist. Entries are written only by the internal
`audit.record()` service, called explicitly from admin controllers.

**Why:** an audit log an admin can edit is not an audit log. **Rejected:** a middleware
that logs everything automatically — harder to reason about, harder to demo, and produces
a feed nobody reads. **Denormalisation accepted:** `targetLabel` is stored because "Role
changed for user 47" is useless after user 47 is deleted.

### D-016 — Maintenance mode rejected on risk grounds
**Why:** the spec requires the deployment to stay live until interviews are over. A
maintenance-mode bug is the one failure that violates that requirement directly, and its
marginal hiring signal over blocking + settings is small. **If revisited:** build last,
gate behind an env-var escape hatch, and verify it is **off** before submission.

### D-017 — Admins cannot enroll or take quizzes
The spec's prose says admins "can do everything"; the matrix says ❌ for both. **The
matrix wins.** Noticing the contradiction and implementing the specific over the general
is a reading-comprehension signal. Be ready to point at the matrix if questioned.

### D-018 — No dark mode ~~(superseded by D-032)~~
**Original:** a half-finished dark mode looks worse than none, and the warm paper palette
is the identity. **Tradeoff:** some users prefer dark. Accepted as a decision, not an
omission.

### D-019 — Users are blocked, never deleted
No delete-user capability. **Why:** cascading deletes across enrollments, completions and
attempts is a data-integrity minefield, and blocking achieves the operational goal.
**Tradeoff:** no GDPR-style erasure. In production that would be a soft-delete plus a
scheduled anonymisation job — real work, out of scope here.

---

## New in v3 — the data-lifecycle review

A second round of proposals (soft delete, trash, retention, publishing workflow,
scheduled publishing, revision history, activity history, instructor analytics,
notifications) was evaluated and mostly rejected. The reasoning is recorded here because
**a documented decision is often worth more than a built feature** — it earns most of the
interview credit at a fraction of the build cost, and it shows the option was considered
rather than missed.

### D-020 — Soft delete rejected; destructive operations refuse instead

**Decision:** no `deletedAt` anywhere. Instead, `DELETE` refuses with **409 Conflict**
when the target has dependents: `"Cannot delete 'React Basics' — 23 students are enrolled."`

**Why:** soft delete touches every query in the system. Every `find` would need a
`deletedAt: null` filter, and one miss means deleted content reappears in a list. Worse,
it collides with the forced-ownership-filter pattern (D-005) — every controller override
would carry two forced filters instead of one, doubling the surface where a spread-order
mistake leaks data.

The delete guard achieves the actual goal (no silent orphaning of enrollments,
completions and attempts) in ~30 lines with zero query surface.

**Tradeoff:** no undo. An admin who genuinely needs a course gone must first remove the
enrollments, which is deliberate friction on an irreversible action.

**Rejected alternatives:** soft delete + admin Trash UI (multi-day, plus restore
semantics — restore a lesson whose course was deleted?); an `archived` flag on Course
(one entity, one filter, but solves a problem the Content Manager worklist already
surfaces).

**Status codes:** 409 for "dependents exist" (state conflict). 422 would also be
defensible; 409 chosen because the conflict is with resource state, not payload validity.

### D-021 — Scheduled publishing rejected; the approach is recorded instead

**Decision:** not built. If it were: store `publishAt` and filter `publishAt <= now()` in
the public query. **No cron, no job runner** — "scheduled" is a filter, not a scheduler.

**Why not built:** an hour for a field, a filter on every blog query, a datetime picker,
and a "scheduled" badge state — for a feature nobody requested. The insight is worth
having; the code is not worth the time.

### D-022 — Revision / version history rejected

**Decision:** not built. **Why:** version rows on every edit, a diff view, and restore
semantics is a subsystem, not a feature — multiple days. (Strapi 5 has a Content History
capability; verify whether it's tier-gated before mentioning it, and note it lives in the
Strapi admin panel, not the Next.js app.)

### D-023 — Notifications rejected

**Decision:** not built. **Why:** email needs a provider, templates and deliverability;
in-app needs an entity, read state, and polling or websockets. Multi-day either way, and
at demo scale nothing generates an event worth notifying anyone about.

### D-024 — Retention policies / automatic cleanup rejected

**Decision:** no scheduled deletion of any kind.

**Why:** an unmonitored cron job that deletes data, running against the deployment the
spec requires to stay live through interviews. There is nothing to retain — three courses
and a handful of attempts. The downside is losing demo data mid-evaluation; the upside is
zero. This is the one proposal that could actively cost the submission.

### D-025 — Content publishing workflow (draft → review → publish) rejected

**Decision:** blog keeps Strapi's two-state Draft & Publish. No review step.

**Why:** there is no reviewer role in the permission matrix. Adding one would mean
inventing a product requirement the brief doesn't contain, then building a state machine
no seeded user would exercise. **Inventing requirements is a negative signal** — it reads
as not being able to tell what the brief actually asked for.

### D-026 — Global banner deferred; `registrationEnabled` kept

**Decision:** `SiteSettings` ships with `siteName` and `registrationEnabled` only. The
banner group (message, severity, link, dismissal) moves to Tier 4.

**Why:** the banner is ~3h for "an admin can display a message" — real but thin
engineering content. `registrationEnabled` is ~20 minutes and is a strong demo beat:
disable registration in the panel, then curl the register endpoint on camera and get a
403. Backend enforcement proven in fifteen seconds.

Keep the cheap half, drop the expensive half. The 3 hours buy two video rehearsals and an
empty-state polish pass, which score higher.

### D-027 — Student activity history rejected as a standalone page

**Decision:** no student-facing timeline. **Why:** `LessonCompletion.completedAt` and
`QuizAttempt.submittedAt` already *are* an activity log, and the place that data earns its
keep is the **"last activity" column on the instructor progress table** — already
specified. Building the same data twice is bloat.

### D-028 — Instructor analytics limited to the existing progress table

**Decision:** no separate analytics surface. Per-question quiz analytics ("78% get Q3
wrong") was tempting — good product thinking, reuses the `answers` JSON — but it lands
below six Tier 3 items that already won't all get built. **Adding a ninth item to a list
you can't finish is noise.**

---

## New in implementation

### D-029 — RBAC granted in code (bootstrap), not the plugin UI

**Decision:** the four roles and their permission grants live in a `ROLE_GRANTS`
map in `backend/src/index.ts` `bootstrap()`, applied idempotently on every boot.
Nothing is enabled by clicking the Users & Permissions admin screens.

**Why:** permissions toggled in the plugin UI are rows in the local database. They
do not travel with the code, so local and the Railway deploy drift, and a fresh
deploy comes up with everything denied. A code map is reviewable in the diff, is
the same everywhere, and pairs naturally with `permission-matrix.test.ts` — both
read from the same intent.

**Tradeoff:** bootstrap only ever *adds* grants; it never revokes. Removing a
permission means editing the map *and* clearing the stale row (or resetting the
role). Acceptable — grants are add-mostly and the test suite catches an over-grant.

**Rejected:** configuring permissions through the admin UI and documenting the
clicks in the README — unreproducible, and invisible in code review.

### D-030 — Registration strips the body, then forces the role

**Decision:** the `register` override runs a yup allowlist with `stripUnknown`
(keeps only `email`, `password`, `fullName`), then sets the new user's role to
`student` from a server-resolved id.

**Why strip rather than reject:** Strapi 5.52 core already 400s on an unknown
`role` param, but a hard reject is worse UX than silently ignoring it, and the
RBAC matrix expects "signup with `role: admin` → account created, as a student".
Stripping gets that; the forced role makes it safe regardless of core behaviour.

**Tradeoff:** two representations of "what a registration accepts" (the yup schema
here and the zod schema on the frontend form). They are intentionally close but
not shared — different runtimes.

### D-031 — Uniqueness enforced via a `dedupeKey` column, not a link-table index

**Decision:** `enrollment` and `lessonCompletion` each carry a server-set
`dedupeKey` string (`"<userId>:<courseId>"` / `"<userId>:<lessonId>"`, private,
not configurable) with a `UNIQUE` index added by a hand-written migration.

**Why:** DATA_MODEL.md asks for a DB unique index on `(student, course)` as "the
actual guarantee". But Strapi 5 stores each relation in its own link table
(`enrollments_student_lnk`, `enrollments_course_lnk`), so a composite unique
across the pair is not a table constraint. `schema.json` `unique: true` on a
scalar *is* honoured — 5.52 just doesn't mirror it to Postgres on its own, hence
the migration. Verified: a duplicate `dedupeKey` insert raises
`duplicate key value violates unique constraint`.

**Enforced twice (D-009):** the controller does a read-then-check for a clean
idempotent response ("you're already enrolled"); the unique index is what holds
under a double-submit race.

**Tradeoff:** one denormalised column per row, kept in sync by the two
controllers that write these tables. Small and contained.

### D-032 — Full light / dark / system theme (supersedes D-018)

**Decision:** the frontend supports Light, Dark and System, defaulting to
System. D-018 (no dark mode) is reversed.

**Why the reversal is safe now:** D-018's real objection was "a half-finished
dark mode looks worse than none". This implementation is not half-finished —
every colour is a token, and the token *values* flip between two hand-tuned
palettes while the token *names* stay the same, so there is exactly one set of
components and no per-theme branching. An audit shows zero hard-coded colours
in any page or component.

**How:** `data-theme` is stamped on `<html>` by a tiny inline script before
first paint (no flash); `ThemeProvider` hydrates from `localStorage`, follows
the OS while in System mode with no reload, and an accessible `ThemeSwitcher`
(menu, Escape, roving focus) sets the choice. `prefers-color-scheme` covers the
pre-hydration frame for a system-dark visitor.

**Tradeoff:** a second palette to maintain, and one `dangerouslySetInnerHTML`
inline script (the standard no-flash technique — it only reads localStorage and
sets an attribute).

### D-033 — Production-readiness pass: write rate limiting, security headers, query indexes

**Decision:** three additions after a full-site review, each closing a concrete gap.

1. **Per-IP write rate limit** — `src/middlewares/rate-limit.ts`, an in-memory sliding
   window (default 60 mutating `/api/*` requests / 60s / IP, 5/60s for
   `change-password`). Reads are untouched; the auth endpoints keep the tighter U&P
   limit. Env-tunable (`RATE_LIMIT_MAX`, `RATE_LIMIT_ENABLED`). The unbounded
   `quiz_attempts` write path was the trigger.
2. **Frontend security headers** — `next.config.ts` sets CSP (`connect-src 'self'` is
   the meaningful one — the browser never calls Strapi, so nothing should phone out),
   `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS,
   `poweredByHeader: false`.
3. **Query indexes** — migration `…query-indexes.js` adds indexes on
   `audit_logs(created_at | category | action)`, `blog_posts(published_at)`,
   `courses(created_at)` — the columns the app sorts and filters on at real data
   volume.

**Tradeoff:** the rate limiter is per-instance (in-memory); a scaled-out deployment
moves it to Redis, same as the `account-state` note. CSP keeps `'unsafe-inline'` for
scripts/styles (Next injects both) — a per-request nonce is the next hardening step.

**Rejected alternative:** capping `quiz_attempts` per (student, quiz) — multiple
attempts with history is a product feature (DESIGN_SYSTEM.md §3).

Put these in the README. Naming your own gaps is a strength signal.

- **No refresh-token rotation.** Fixed-lifetime JWT; logout clears the cookie but doesn't
  revoke server-side. Would add a refresh endpoint + server-side session store.
- **Rate limiting is per-instance.** In-memory sliding window (D-033); U&P covers
  login/register. A horizontally-scaled deploy needs a shared store (Redis).
- **No E2E tests.** Backend authorization prioritised given the timeline.
- **No image uploads** — cover images are URLs (spec permits this). Railway's filesystem
  is ephemeral; real uploads would need S3 or Cloudinary.
- **Lesson ordering** is a manual integer, not drag-and-drop.
- **Quizzes are single-answer MCQ only.** The `isCorrect`-per-option model extends to
  multi-answer without a schema change.
- **Stats cached 60s** — briefly stale by design.
- **No maintenance mode.** See D-016.

---

## New in the review pass

### D-034 — Instructor catalogue scope is forced in the controller, not the query string

**Decision:** `course.find` re-applies `instructor = ctx.state.user.id` for the
instructor role, ANDed on last, the same way `create` forces the owner and
`lesson.find` forces its filter.

**Why:** the frontend used to send `filters[instructor][id][$eq]=<self>` on the
`/manage/courses` list. `sanitizeQuery` silently *drops* any filter clause that
traverses `plugin::users-permissions.user`, because the instructor role has no
read grant on that type — so the filter never reached the database and an
instructor's manage list showed every course on the platform (writes were still
blocked by `is-course-owner`, but the matrix says "own only" and a reviewer
would see the leak). A forced controller filter can't be stripped: it's applied
after sanitisation, on the server, from the token.

**Tradeoff:** `/api/courses` is still a public endpoint that returns every course
to anyone — that's the catalogue and it's intentional. Only the *manager* view
is scoped; the scoping key is the caller's role + id, never a query param.

**Rejected alternative:** a dedicated `/api/courses/mine` endpoint — more surface
for the same result; the role check in the existing controller is enough.

### D-035 — Site-wide search is a server-side WHERE clause, debounced on the client

**Decision:** the catalogue, the manage-courses list, the blog, the admin users
table and the audit log all take a `q` param that Strapi turns into a
`$containsi` filter (`$or` over title/description where it applies). The input is
a client component that debounces keystrokes (~350ms) and writes `q` into the
URL via `router.replace`; the server component reruns the query. Any `page`
param is dropped on a new search.

**Why:** searching must span the whole dataset, not the page on screen. Because
`q` is a filter, the result set *and* the pagination `total` reflect the match —
"12 courses matching 'react'" is a real count, and page 2 of a search is page 2
of the filtered rows. Debouncing keeps it to roughly one request per settled
query instead of one per keystroke. The URL holds the state, so a search is
shareable and survives back/forward.

**Tradeoff:** `$containsi` is a substring scan, not full-text ranking. At this
data volume (tens of courses, hundreds of posts) with the `slug`/`created_at`
indexes it's instant; a large corpus would want Postgres `tsvector` or a search
service. The managed-blog list is the one exception — it's small and unpaginated,
so it filters in memory.

### D-036 — Aggregate counts never come off a page

**Decision:** every "total X" shown in the UI is a `COUNT(*)` (the admin
`/platform/stats` endpoint) or the `meta.pagination.total` from the same filtered
query — never `items.length` of the current page. The instructor dashboard
totals fold over *all* pages of the owned-course list, not the first.

**Why:** a stat that changes when you click "next page" is a bug. Keeping counts
and rows on the same filter/where keeps them honest under both pagination and
search.

### D-037 — Quiz attempts store a self-contained review snapshot

**Decision:** `buildAttemptReview` (pure, in `grading.ts`) freezes each
question's prompt, the chosen option's text, and the correct option's text into
the `quiz_attempt.answers` JSON at submit time. `GET /api/quiz-attempts/me`
returns it; a new `/results` page renders the full per-question review from it.

**Why:** "the quiz result is stored and viewable later" (spec) has to survive the
quiz being edited or a question deleted afterwards. Reading the snapshot needs no
join back to the live quiz, so an old attempt always renders exactly as it was
taken. Same discipline as `toStudentQuiz` — the row can only contain what it
names. Attempts written before this change keep only the score; the UI shows
those as "score only".

**Tradeoff:** a few hundred bytes more per attempt. Acceptable for an immutable
historical record.

### D-038 — Per-course lesson progression rule (`free` / `complete_locked` / `open_locked`)

**Decision:** `course.lessonProgression` is a new required enum, default `free`.
Three modes:

- `free` — view and complete lessons in any order (the prior behaviour).
- `complete_locked` — every lesson is viewable, but a lesson can only be
  *completed* once every earlier lesson (course order: `order ASC, id ASC`) is
  completed.
- `open_locked` — a later lesson cannot be *opened* until every earlier lesson is
  completed; its body is not sent by `/learn` and completion is gated too.

The rule lives in pure functions in
`api/lesson-completion/services/progression.ts` (`canCompleteLesson`,
`canOpenLesson`, `lessonGates`, `normalizeProgression`) — plain ordered-lesson
data in, decisions out, no `ctx`, unit-tested without booting Strapi. The same
functions run in `course.learn` (to annotate each lesson `status` / `locked` /
`canComplete` / `lockHint` and to strip a locked lesson's `content`/`videoUrl`)
and in `lesson-completion.complete` (to reject a forbidden completion with 403).
The setting is changed through the existing `PUT /api/courses/:id`, already gated
by `global::has-role` + `global::is-course-owner`; the controller only adds an
enum-validity check. Students have no `course.update` grant, so they can never
change it.

**Why:** enforcement has to be server-side — a direct `POST
/api/lesson-completions/complete` or a deep link to `/learn/:course/:lesson`
must be refused regardless of the UI. Deriving "required previous lessons" from
the existing `order` (rather than storing a prerequisite graph) means reordering,
inserting and deleting lessons need no extra bookkeeping. `normalizeProgression`
maps any unknown/null value to `free`, so existing courses and rows created
outside the controller behave exactly as before.

**Migration:** `2026.08.31…course-lesson-progression.js` backfills
`lesson_progression = 'free'` for existing rows and sets the column default;
idempotent. No data is destroyed and already-recorded completions are untouched
(a stale earlier completion just means a later lesson shows as available).

**Tradeoff:** the `complete` path does two extra reads (course lessons + this
student's completions) when the mode isn't `free`. Negligible at this scale and
only on the write path.

**Rejected alternative:** a separate `LessonPrerequisite` join model — more
surface, and it would drift from `order` the moment a lesson is reordered. A
per-lesson `isLocked` flag was also rejected: lock state is derived from the
student's progress, not stored.

### D-039 — Course / lesson / quiz visibility as an explicit field, owner-toggled

**Decision:** a course carries `status ∈ {draft, enrolled_only, published}`; a
lesson and a quiz each carry a `published` boolean. Owner / manager flips them
through `POST /api/{courses,lessons,quizzes}/:id/{publish,unpublish}` (same gate
as edit/delete), each writing one audit row. New courses start `draft`; new
lessons/quizzes start `published`.

- `published` — in the public catalogue, open for enrolment.
- `enrolled_only` — catalogue-hidden, no new enrolments; students already
  enrolled keep `/learn` + quiz access. ("Closed cohort still finishing.")
- `draft` — owner-only; `/learn` returns 403 even for a leftover enrolment.
- An unpublished lesson leaves every student surface: the catalogue non-empty
  check, `/learn`, progression gates, and every progress denominator
  (`/enrollments/me`, `student-progress`, the `complete` reply). Recorded
  completions are kept, just not counted while hidden.
- An unpublished quiz 404s on `/take` + `/submit` and drops out of `/learn`;
  recorded attempts are untouched.

**Why not native Draft & Publish:** `draftAndPublish` stays **off** on all three.
Turning it on rewrites every query (a `status` param on each `find`, a
draft/published id split) and collides with the forced-ownership-filter pattern
(D-005). An explicit field gated by forced `$and` filters is the same shape as
every other scope in the codebase and touches only the queries that care.

**Relationship to earlier decisions:** this is **not** D-021 (still no
scheduling — no `publishAt`, no cron) and **not** D-025 (still no draft → review
→ publish workflow — there is no reviewer role; the owner is the only actor). It
is a single-actor visibility toggle, the same two-state idea D-006 already
accepted for the blog, extended to a third "enrolled-only" state because a course
has a roster a blog post doesn't. It also supersedes the "catalogue hides empty
courses" heuristic (Tier 2.5) as the *primary* visibility control — that filter
stays as a secondary guard so a `published` course with no published lessons
still can't reach the catalogue.

**Tradeoff:** `findOne` does one extra enrolment read for the `enrolled_only`
case; `/learn` and the progress paths each carry one more `where` clause. Public
list helpers (`getCourseByDocumentId`, `getCourseBySlug`) now forward the
caller's token so the backend can resolve visibility per role.

**Rejected alternative:** a binary course `published` flag — simpler, but there's
no way to retire a course from the catalogue without also locking out the cohort
mid-way. A per-lesson `draft`/`review`/`published` enum — that's D-025's workflow
with extra steps.

---

## Template

```
### D-0NN — <one line>
**Decision:**  **Why:**  **Tradeoff:**  **Rejected alternative:**
```
