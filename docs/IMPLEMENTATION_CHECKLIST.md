# IMPLEMENTATION_CHECKLIST.md — Lernexa

**Supersedes v1.** Nine phases. Each ends deployed and working.

## Git rules

- Conventional Commits, scoped: `feat(backend):`, `fix(frontend):`, `test:`, `docs:`, `chore:`
- **Target 8 to 10 commits total.** Group your work logically and commit at the end of each major phase.
- **Never** build everything then fabricate history. Reflog, timestamps and file-change
  patterns give it away, and the spec calls it a negative signal.
- Short-lived branches + PRs for the four differentiators (`feat/progress`, `feat/quiz`,
  `feat/admin-panel`, `feat/blog`), merged `--no-ff`. Behind schedule? Straight to
  `main` with good messages is fine. A fake PR is not.
- Write a body on non-obvious commits. One line of *why* beats a perfect subject.

## Execution rules

### 1. Freeze the deployment before recording
Record the video against a deployment you then **do not touch**. If you deploy after
recording, the video may demo something that no longer exists, and a reviewer clicking
your Vercel link expects to see what you showed. Tag the recorded commit.

### 2. Write the README early
It's listed under Phase 8, but drafting it early forces clarity about what you're actually building. Update it as features land.

---

## Git rules (continued)

Good:
```
feat(backend): force owner filter on enrollment.find

Role permissions alone let a student pass ?filters[student][id]=N and
read another student's enrollments. The controller now overwrites the
student filter from ctx.state.user AFTER sanitizeQuery — spread order
matters, the forced filter must come last.
```
Bad: `update`, `fixes`, `wip`, `final2`.

---

## Phase 0 — Repo + deploy skeleton (~2h)

- [ ] `git init`, root `README.md`, `.gitignore` (node, .env, .strapi, .next)
- [x] `docs/*.md` in repo
- [ ] `backend/` — Strapi 5, TypeScript, Postgres. **Pin ≥5.37.0**, use latest 5.x
- [ ] `frontend/` — Next.js **≥16.3.3**, App Router, TS, Tailwind
- [ ] Railway: Postgres service + Strapi service, root dir `backend`, env vars set
- [ ] Vercel: root dir `frontend`, `STRAPI_URL` (server-only, **not** `NEXT_PUBLIC_`)
- [ ] **Both URLs load in a browser**
- [ ] CORS in `backend/config/middlewares.ts` allows the Vercel origin

**Commits:** `chore: initialise lernexa monorepo` · `docs: add engineering plan` · `chore(backend): scaffold strapi 5 with postgres` · `chore(frontend): scaffold next.js` · `chore: deploy skeleton to railway and vercel`

**Understand:** why Postgres not SQLite on Railway; what each Strapi secret does;
`NEXT_PUBLIC_` vs server-only env vars.

---

## Phase 1 — Brand + content types (~3h)

- [ ] Design tokens in Tailwind config (ink/paper/marigold, 4px scale, radius 4)
- [ ] IBM Plex Sans/Serif/Mono via `next/font/google`
- [ ] `icon.svg` (three-bar mark), `apple-icon.png`, root metadata with title template
- [ ] Content types: Course, Lesson, Enrollment, LessonCompletion, Quiz, QuizAttempt, BlogPost
- [ ] Components `quiz.question`, `quiz.option`
- [ ] User extensions: `fullName`, `avatarUrl`, `blockedReason`, `blockedAt`, `blockedBy`
- [ ] Draft & Publish on BlogPost only
- [ ] `bootstrap()` creates the four roles
- [ ] **Deny by default** — zero permissions on all four roles

**Commits:** `feat(frontend): lernexa design tokens and typography` · `feat(frontend): brand mark and metadata` · `feat(backend): course and lesson content types` · `feat(backend): enrollment and progress content types` · `feat(backend): quiz content types and components` · `feat(backend): bootstrap application roles`

**Understand:** why `instructor` is an explicit relation, not `createdBy`; why
`LessonCompletion` exists instead of a `progress` field.

---

## Phase 2 — Auth + session (~3h)

- [ ] Register override: role always `student`, body `role` stripped, zod allowlist as second layer
- [ ] `lib/strapi.ts` — imports `server-only`, attaches Bearer
- [ ] `lib/session.ts` — cookie set/read/clear, `getCurrentUser()` in React `cache()`
- [ ] `/api/auth/{login,register,logout}` route handlers
- [ ] Cookie: `httpOnly`, `secure`, `sameSite=lax`
- [ ] `middleware.ts` — presence check + redirect (UX only)
- [ ] Login/register pages, branded, zod-validated
- [ ] Role-aware post-login redirect

**Test:** each role logs in and `getCurrentUser()` returns the right role.
`document.cookie` in DevTools does **not** show the session. Registering with
`{"role":"admin"}` still produces a student.

**Commits:** `feat(backend): force student role on public registration` · `feat(frontend): server-only strapi client` · `feat(frontend): httpOnly cookie session` · `feat(frontend): login and register pages` · `feat(frontend): auth middleware`

**Understand:** the localStorage-vs-httpOnly tradeoff **in both directions**; why
middleware is UX not security; where the JWT physically lives at each hop.

---

## Phase 3 — Courses, lessons, ownership (~4h)

The RBAC core. Most heavily weighted part. Don't rush.

- [ ] Policies: `is-admin`, `has-role`, `is-course-owner`, `is-lesson-owner`
- [ ] Course controller forces `instructor = ctx.state.user.id` for instructors
- [ ] Policies attached per RBAC.md
- [ ] U&P: exactly the matrix permissions; **disable `GET /api/users` and `PUT /api/users/:id` for non-admins**
- [ ] Public course list + detail
- [ ] `(manage)` dashboard, course list scoped to caller, CRUD forms
- [ ] Lesson CRUD with `order`
- [ ] Server Actions for all mutations + `revalidatePath`
- [ ] **Delete guard:** `DELETE /api/courses/:id` returns 409 with the enrollment count
      when dependents exist; same for lessons with completions (Tier 2.5, D-020)
- [ ] **Catalogue filter:** courses with zero lessons don't appear in the public list

**Test with curl, not the UI:** instructor2 PUTs instructor1's course → 403. Student
POSTs a course → 403. Instructor creates a course sending someone else's `instructor`
id → still owned by themselves.

**Commits:** `feat(backend): ownership policies` · `feat(backend): enforce course ownership on write` · `feat(backend): scope lesson writes to course owner` · `feat(frontend): public course browsing` · `feat(frontend): course management dashboard` · `feat(frontend): lesson crud`

**Understand:** policy vs middleware vs controller override — when each runs; why
forcing the owner on *create* matters as much as checking on *update*.

---

## Phase 4 — Enrollment, learning, progress (~4h)

- [ ] `POST /api/enrollments/enroll` — idempotent, student from token
- [ ] `GET /api/enrollments/me` — layer-4 forced filter
- [ ] DB unique index migration (**inspect the real link-table schema first**)
- [ ] `computeProgress()` — **pure function**, plain data, no `ctx`
- [ ] `computeProgressForCourse()` — **batched, 2 queries** for all students
- [ ] `POST /api/lesson-completions/complete` — requires enrollment, upserts
- [ ] `DELETE /api/lesson-completions/:lessonId`
- [ ] `GET /api/courses/:id/learn` — one round trip
- [ ] `ProgressBar`, `ProgressRing`, `ProgressTrack` components
- [ ] Enroll flow; My Courses with progress
- [ ] Lesson viewer: `ProgressTrack` sidebar, serif reading column, prev/next, mark complete
- [ ] Optimistic mark-complete with rollback
- [ ] Progress persists across hard refresh — verify explicitly

**Test:** `progress.test.ts` — 0 lessons, 0 complete, all complete, deleted lesson.
Manually: complete 2 of 4, refresh, still 50%.

**Commits:** `feat(backend): idempotent enrollment` · `feat(backend): derive progress from completions` · `perf(backend): batch course progress into two queries` · `test(backend): progress edge cases` · `feat(backend): learning context endpoint` · `feat(frontend): progress components` · `feat(frontend): lesson viewer`

**Understand:** why progress is derived; what happens to a 100% student when a lesson is
added and why that's correct; where the unique constraint actually lives; **what the
naive progress table would have cost in queries.**

---

## Phase 5 — Quiz + grading (~4h)

Highest-risk security surface.

- [ ] **Disable `find`/`findOne` on Quiz for the student role**
- [ ] `toStudentQuiz()` — explicit field mapping, drops `isCorrect`
- [ ] `GET /api/quizzes/:id/take` — enrolled only
- [ ] `gradeQuiz()` — **pure function**
- [ ] `POST /api/quizzes/:id/submit` — grades, stores attempt with snapshot
- [ ] `GET /api/quiz-attempts/me` — forced filter
- [ ] Quiz builder for instructor/CM
- [ ] Quiz taking: one question per screen, no submit with blanks
- [ ] Results: score + per-question review
- [ ] **Verify the leak is closed:** view page source and the network tab, search for a
      correct answer string

**Test:** `grading.test.ts` — all correct, all wrong, partial, missing answer, unknown
option id, empty quiz. Curl `GET /api/quizzes/1` as student → 403.

**Commits:** `feat(backend): sanitised quiz endpoint for students` · `feat(backend): server-side quiz grading` · `test(backend): quiz grading edge cases` · `feat(backend): persist attempts with snapshot` · `feat(frontend): quiz builder` · `feat(frontend): quiz taking and results`

**Understand:** every path `isCorrect` could reach the browser — including the RSC
payload — and how each is closed; why the attempt stores a snapshot.

---

## Phase 6 — Admin panel + blocking (~4h)

- [ ] `GET /api/platform/users` — paginated, searchable, role/status filters
- [ ] `PUT /api/platform/users/:id/role` — all four guards
- [ ] `PUT /api/platform/users/:id/block` — all guards + required reason
- [ ] **Test whether Strapi re-checks `blocked` per request.** Block a user, replay their
      token. Record the finding.
- [ ] Global middleware re-checking `blocked` → 403 `ACCOUNT_BLOCKED` (if needed)
- [ ] Next.js catches `ACCOUNT_BLOCKED` → clear cookie → `/account-blocked`
- [ ] `GET /api/platform/stats` — `Promise.all`, cached 60s
- [ ] `(admin)` route group with layout-level check
- [ ] Admin dashboard: stats strip + attention queue
- [ ] **Attention queue includes "quizzes with no correct answer marked"** (Tier 2.5) —
      the silent-failure check; one count query
- [ ] **`SiteSettings` single type with `siteName` + `registrationEnabled`** (Tier 2.5),
      enforced in the register controller, **not** by hiding the signup link
- [ ] Users table with role select + block modal
- [ ] Cross-platform content views
- [ ] Verify content-manager hitting `/admin` gets 403
- [ ] Curl the register endpoint with `registrationEnabled: false` → 403

**Commits:** `feat(backend): admin user management` · `feat(backend): user blocking with reason` · `feat(backend): revalidate account state per request` · `feat(backend): guard against removing the last admin` · `perf(backend): parallel cached platform stats` · `feat(frontend): admin dashboard` · `feat(frontend): user role and block management`

**Understand:** **the stateless-JWT question.** Why blocking a user doesn't revoke their
token, and what you did about it. Also: the cost of the per-request check and what
you'd do at scale.

---

## Phase 7 — Blog, tests, seed (~4h)

- [ ] BlogPost CRUD, author forced from token
- [ ] Draft/publish; **verify the `status` param behaviour for your Strapi version**
- [ ] Public blog list + post — anonymous sees **zero** drafts
- [ ] `permission-matrix.test.ts`
- [ ] `scripts/verify-auth.sh` (8 cases from RBAC.md)
- [ ] `scripts/seed.ts` — idempotent, **includes instructor2 and a blocked user**
- [ ] **Run seed against production**
- [ ] *(If time)* Audit log + site settings + banner

**Commits:** `feat(backend): blog posts with draft publish` · `feat(frontend): public blog and editor` · `test(backend): permission matrix coverage` · `chore(backend): idempotent seed script` · `test(backend): authorization smoke script`

---

## Phase 8 — Freeze, polish, ship

- [ ] Empty states, skeletons, `error.tsx`, `not-found.tsx`, `/forbidden`, `/account-blocked`
- [ ] Role-differentiated dashboards finalised
- [ ] Toasts on mutations
- [ ] Mobile check on the three main flows
- [ ] Keyboard nav + focus rings on forms and quiz
- [ ] README: setup, env vars, features completed, **demo credentials**, known limitations
- [ ] Final deploy, seed prod, walk every flow on the **live** URLs
- [ ] Record video (budget 3h)

**Commits:** `feat(frontend): loading error and forbidden states` · `docs: readme with setup and demo credentials` · `chore: final production deploy`

---

## Video plan (≤10 min — reviewed most closely)

Rehearse once. Tabs and terminal open before recording.

| Time | Segment |
|---|---|
| 0:00–0:30 | Lernexa, the stack, architecture in one sentence: *"Strapi is the security boundary; Next.js holds the session and never exposes the token."* |
| 0:30–3:00 | Live demo: student resume → lesson → progress → quiz → score; instructor course → lesson → quiz → blog; admin role change + block |
| 3:00–4:00 | Data flow: mark-complete, click → Server Action → Strapi → policy → DB → back |
| 4:00–5:45 | **RBAC via curl against live Railway.** Student POST course → 403. Instructor2 PUT instructor1's course → 403. Student GET quiz → 403. Blocked user's valid token → 403. Then show the policy and the forced filter, and call out the spread-order point. |
| 5:45–7:00 | Progress: derived model, `computeProgress`, the added-lesson decision, **and the batched 2-query table vs 61 naive queries** |
| 7:00–8:15 | Quiz: `gradeQuiz()` line by line, `toStudentQuiz()`, why answers never leave the server |
| 8:15–9:15 | Admin: blocking + **the stateless-JWT question and what you found when you tested it**; blog draft → publish, invisible to anonymous |
| 9:15–10:00 | Deployment: Railway + Postgres, Vercel, env vars. Close with one honest limitation and what you'd do next. |

Ending on a real limitation reads as senior. Pick one: no refresh-token rotation, no
rate limiting on login (Strapi has none by default), no E2E tests — and say what you'd
do about it.

**What to leave out of the video:** the design system, the tokens, the folder structure.
Nobody scores those on camera. Spend the time on authorization and the two algorithms.
