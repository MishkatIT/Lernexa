# PROJECT_PLAN.md — Lernexa

**Supersedes v1.** Product name: **Lernexa**. Use it everywhere — page titles, metadata,
README, seed data, the video.

## Hard constraints (spec PDF — non-negotiable)

| Constraint | Value |
|---|---|
| Frontend | Next.js on Vercel |
| Backend | Strapi on Railway |
| Stack deviation | Submission void |
| Roles | admin, content-manager, instructor, student |
| Deliverables | Public repo (FE+BE), live Vercel URL, live Railway URL, ≤10 min video |
| Commit history | Genuinely incremental. Single commit = negative signal. |
| Uptime | Must stay live until interviews are over |
| README | How to run locally + features completed |

## The governing constraint: reviewer attention, not feature count

The reviewer spends ~20 minutes on the repo and 10 on the video. Feature #12 is never
seen. Feature #3, explained badly, sinks the submission.

**Five features at production depth beat fifteen at tutorial depth.** A sprawling
feature set in a 4-day junior submission reads as AI output, not ambition. Restraint is
part of what is being measured.

## Product thesis

Lernexa is about **progress, not catalogue**. Competitors lead with a course grid;
Lernexa leads with where you are. This cascades:
- Data model: progress derived from completion facts, never stored
- Design: progress is the core visual primitive, at three scales
- Dashboards: each role's home answers one question, not "here are some numbers"

## Feature tiers — FINAL

### Tier 1 — Must have (spec baseline, non-negotiable)
- Auth: signup/login, four roles, enforced on the backend
- Course CRUD with **ownership** enforcement
- Lesson CRUD under courses, ordered
- Student browse → enroll → "My Courses"
- Sequential lesson viewing
- Both apps deployed, seeded, demo credentials in the README
- Real commit history

### Tier 2 — Strong (the spec's four differentiators)
- Progress tracking: accurate per student/course, persists, derived
- MCQ quiz, **server-side** auto-grading, stored attempts
- Admin panel: users, role management, platform stats, cross-platform content
- Blog with draft/published; public sees published only

### Tier 2.5 — Near-free correctness wins (do these; they take minutes)

Added after the data-lifecycle review. Each fixes a real correctness or product problem
for almost no time. Build them inside the phase they belong to, not as a separate pass.

- **Delete guard** (~30 min) — `DELETE /api/courses/:id` returns **409** with the
  dependent count when enrollments exist. Replaces soft delete entirely; see D-020.
  Same guard on lessons with completions.
- **Catalogue hides empty courses** (~10 min) — a course with zero lessons must not
  appear in the public list. A one-line relation filter fixes a real broken experience.
- **Quiz integrity check** (~20 min) — surface quizzes where no option is marked correct
  in the admin attention queue. Real data bug: every student silently scores zero on that
  question.
- **`registrationEnabled` setting** (~20 min) — a `SiteSettings` field enforced in the
  register controller. Strong 15-second video beat: disable it, then curl the endpoint
  and get a 403.

### Tier 3 — Exceptional (build in this order, stop when time runs out)

1. **Batched progress queries** (~2h) — instructor student-progress table in 2 queries
   instead of 1+2N. Highest pure-engineering signal in the project.
2. **User blocking + JWT revalidation** (~2.5h) — Strapi already has `blocked`. The real
   value is the stateless-auth question it sets up. See RBAC.md.
3. **Role-differentiated dashboards** (~3h) — four questions, shared components,
   different queries. Best product-thinking signal per hour spent.
4. **Branding + design system discipline** (~3h) — see DESIGN_SYSTEM.md.
5. **`GET /api/courses/:id/learn`** (~1h) — one purpose-specific endpoint replacing a
   four-call waterfall.
6. **`permission-matrix.test.ts`** (~2h) — table-driven, encodes the PDF's matrix.
   **Point it at the deployed URL and run it on camera** — 15 seconds of a green
   role × endpoint table communicates more about RBAC correctness than any amount of
   clicking.
7. **Audit log** (~2h) — only meaningful once #2 exists. Append-only, immutable.

### Tier 4 — Skip (explicitly decided against)

| Feature | Why skipped |
|---|---|
| **Soft delete / `deletedAt`** | Touches every query in the system; one missed filter and deleted content reappears. Collides with the forced-ownership-filter pattern. Replaced by the delete guard, Tier 2.5 (D-020). |
| **Admin Trash / permanent deletion** | Entirely dependent on soft delete. Plus a full screen with restore edge cases. |
| **Retention policies / auto cleanup** | Unmonitored scheduled deletion against a deployment that must stay live through interviews. Nothing to retain. All downside (D-024). |
| **Global banner** (message/severity/link/dismissal) | ~3h for "an admin can display a message." Those hours buy two video rehearsals instead. `registrationEnabled` kept — see Tier 2.5 (D-026). |
| **Scheduled publishing** | The insight (`publishAt <= now()` filter, not a cron) is recorded in DECISIONS.md. The code isn't worth an hour (D-021). |
| **Revision / version history** | A subsystem, not a feature. Multi-day (D-022). |
| **Draft → review → publish workflow** | No reviewer role exists in the matrix. Would mean inventing a requirement — a negative signal (D-025). *Note: a single-actor visibility toggle (no review step) was later added for courses/lessons/quizzes — D-039. That's the blog's D-006 idea, not this workflow.* |
| **Notifications (email or in-app)** | Multi-day for delivery infrastructure; nothing at demo scale generates a notifiable event (D-023). |
| **Student activity-history page** | Already surfaced where it matters — "last activity" on the instructor table (D-027). |
| **Instructor analytics surface** | Per-question stats were tempting but land below six Tier 3 items that already won't all ship (D-028). |
| Maintenance mode | Highest risk, lowest marginal signal. A bug kills the live deployment the spec requires to stay up. If built at all: last, with an env-var escape hatch, tested **off** before submission. |
| Suspend *and* block as separate states | Two states, one enforcement path, no product value. One `blocked` state with a reason + audit entry is cleaner and defensible. |
| Logo/favicon upload via admin | Railway filesystem is ephemeral. Ship static assets. |
| True "active users" metric | Needs a write per request. Redefine as "users with a completion in the last 7 days" — same insight, zero new writes. |
| Support/contact settings, site description | Settings nothing reads. |
| Certificates, discussions, notifications, email, payments | Out of scope. |
| Image/file uploads | Spec permits URLs. Ephemeral FS makes uploads a liability. |
| Refresh-token rotation | Real work, invisible to the reviewer. Name as a known limitation. |
| Monorepo tooling (Turborepo/nx) | Two folders is enough. |
| Frontend component tests | Budget goes to authorization and business-logic tests. Say so in the README. |
| 30-screen UI spec | Specs for screens you won't polish are dead weight. Six specified properly. |

## Schedule — Phase Breakdown

| Step | Phases | Must be true at end of step |
|---|---|---|
| **Step 1** | P0–P1 | Both apps deployed with hello-world. Content types + roles done. |
| **Step 2** | P2–P3 | Login end-to-end against deployed Strapi. Course + lesson CRUD, ownership curl-verified. |
| **Step 3** | P4–P5 | Enrollment, `/learn`, batched progress, quiz take + grade + results. |
| **Step 4** | P6–P7 | Admin panel + blocking + blog. Tests. Design pass. Seed prod. |
| **Step 5** | P8 | **Feature freeze.** Polish, README, video submission. |

### The rule that decides this round
**Deploy immediately, before writing a feature.** CORS, Postgres SSL, Railway's root directory, and env vars each fail in ways that eat hours. Discovering that at the end is the most common way people lose with a working local app.

## Cut list (top-down, if behind)

1. Platform settings + banner
2. Audit log
3. `/learn` endpoint (fall back to separate calls)
4. Quiz retakes (single attempt, documented as a decision)
5. Content-manager worklist dashboard (plain list instead)
6. Blog cover images

**Never cut:** backend authorization, server-side grading, progress accuracy,
deployment, seed accounts, the video.

## Definition of done (per feature)

1. Works against the **deployed** Strapi, not localhost
2. Authorization verified with curl, not by clicking the UI
3. Committed with a message explaining *why*
4. **You can explain the data flow out loud in one paragraph**

If (4) fails, it isn't done. That is the actual exam.
