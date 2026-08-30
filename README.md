# Lernexa

A Learning Management System built around one idea: **progress, not catalogue.**
Every screen answers *"where am I?"* before *"what's available?"*

- **Frontend:** Next.js 16 (App Router, Server Components) on Vercel
- **Backend:** Strapi 5 (TypeScript) on Railway
- **Database:** PostgreSQL

Strapi is the security boundary and the only thing that touches the database. Next.js is
a server-rendered client that holds the session cookie and never exposes the JWT to the
browser.

## New here? Read the system overview

**[`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md)** explains the whole system — the
stack, architecture, RBAC, every feature, routes, API, data model, user flows,
deployment, testing, security and technical decisions — in ~10–15 minutes, with diagrams
and file references. [`docs/README.md`](docs/README.md) indexes the rest of the docs.

## Live

| | URL |
|---|---|
| Frontend (Vercel) | https://frontend-xi-silk-30.vercel.app |
| Backend / API (Railway) | https://lernexa-production.up.railway.app |
| Strapi admin | https://lernexa-production.up.railway.app/admin |

## Repository layout

```
Lernexa/
├── backend/     Strapi 5 — Railway root directory
├── frontend/    Next.js 16 — Vercel root directory
└── docs/        Engineering plan, architecture, RBAC, data model, decisions
```

## Prerequisites

- **Node 22 LTS** (see `.nvmrc`). Node 20 LTS also works. Non-LTS versions are not supported by Strapi 5 / Next 16.
- npm 10+
- A PostgreSQL database for the backend (local or hosted). Postgres everywhere — no SQLite fallback.

## Run locally

### 1. Backend (Strapi)

```bash
cd backend
cp .env.example .env        # then fill in the secrets — see below
npm install
npm run develop             # http://localhost:1337  (admin at /admin)
```

**Backend environment variables** (`backend/.env`):

| Variable | Purpose |
|---|---|
| `HOST` / `PORT` | Bind address. `0.0.0.0` / `1337` locally. |
| `APP_KEYS` | Comma-separated session-cookie signing keys. |
| `API_TOKEN_SALT` | Salt for hashing API tokens. |
| `ADMIN_JWT_SECRET` | Signs Strapi **admin panel** sessions. |
| `TRANSFER_TOKEN_SALT` | Salt for data-transfer tokens. |
| `JWT_SECRET` | Signs **end-user** (Users & Permissions) JWTs — this is the token Lernexa's session cookie carries. |
| `ENCRYPTION_KEY` | Encrypts stored secrets (Strapi 5). |
| `DATABASE_CLIENT` | `postgres` (local and deploy). |
| `DATABASE_URL` | Full Postgres connection string. On Railway set it to `${{Postgres.DATABASE_URL}}`; blank locally (use the discrete `DATABASE_*` vars). |
| `DATABASE_SSL` | `true` on Railway, `false` locally. |

Generate each secret fresh — never reuse the values Strapi prints in dev:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

### 2. Frontend (Next.js)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

**Frontend environment variables** (`frontend/.env.local`):

| Variable | Purpose |
|---|---|
| `STRAPI_URL` | Base URL of the Strapi API. **Server-only — never `NEXT_PUBLIC_`.** |
| `SESSION_COOKIE_NAME` | Name of the httpOnly session cookie (default `lms_session`). |

## Deployment

- **Railway** hosts Strapi. Add a Postgres service; set the service root directory to `backend/`; set every secret above (`DATABASE_URL` is injected by the Postgres plugin). Build `npm run build`, start `npm run start`.
- **Vercel** hosts Next.js. Root directory `frontend/`; set `STRAPI_URL` to the Railway URL (server-only).
- CORS in `backend/config/middlewares.ts` must list the Vercel origin.

## Features completed

Every feature in the project spec — all **core features**, all **differentiator
features**, and the full **4-role permission matrix** — is implemented and enforced on
the backend.

### Core features

| Feature | Where |
|---|---|
| Sign up / log in, a role per user | `frontend/src/app/api/auth/*`, `backend/src/extensions/users-permissions/` |
| Role-based protected routes, **enforced on the backend** (not just hidden UI) | 4 layers — see _Role-based access_ below |
| Course create / edit / delete per the matrix (Content Manager platform-wide, Instructor own only) | `backend/src/api/course/`, `frontend/src/app/manage/courses/` |
| Lessons under a course — title + content, where content is text **or** a video URL | `backend/src/api/lesson/`, `frontend/.../manage/courses/[id]` |
| Student browses courses and enrolls | `POST /api/enrollments/enroll`, `frontend/.../courses/[slug]` |
| Enrolled courses shown separately under **"My courses"** | `/dashboard` → "My courses" section |
| Student views lessons of enrolled courses **in sequence** | `/learn/[courseId]/[lessonId]` (order `ASC, id ASC`) |

### Differentiator features

| Feature | Notes |
|---|---|
| **Progress tracking** — mark a lesson complete; per-course %; accurate per student; persists across refreshes | Progress is **derived** from `LessonCompletion` rows (no stored percentage), computed by the pure `computeProgress()`. Persisted in Postgres. |
| **Quiz + auto-grading** — MCQ (question + options + correct answer); instant score on submit; result stored and viewable later | Graded server-side by the pure `gradeQuiz()`; the answer key (`isCorrect`) never reaches the browser. Each attempt stores a frozen question/answer snapshot — see `/results`. |
| **Admin panel** — admin-only dashboard; see all users and change roles; manage all courses / lessons / blog posts; basic platform stats | `/admin` — total users per role, total courses, total enrollments, plus an attention queue and block/unblock with an audit trail. |
| **Blog** — Content Manager & Admin write / edit / publish / delete; draft vs published; anyone reads the published list and a single post; Admin controls every post | Strapi's native Draft & Publish. Non-managers are forced to published-only **server-side** (a `?status=draft` in the query string is ignored). |

### Role-based access

Assume the frontend does not exist — every rule holds against raw `curl` with a valid
token. Four enforcement layers:

1. **Account state** — a global middleware re-checks `blocked` on every authenticated request.
2. **Role** — a `ROLE_GRANTS` map in `backend/src/index.ts`, applied and reconciled on every boot. Deny by default.
3. **Resource ownership** — route policies (`is-course-owner`, `is-lesson-owner`, `is-quiz-owner`); lesson / quiz / progress ownership resolves through `course.instructor`.
4. **Query scoping** — list controllers force the ownership filter **last**, so a client `?filters=` cannot widen it.

Proof: `backend/tests/permission-matrix.test.ts` (the matrix encoded as data) and
`backend/scripts/verify-auth.sh` (8 `curl` checks against the deployed API).

> **Role assignment:** public sign-up always creates a **student** — accepting a `role`
> from an unauthenticated request would be privilege escalation. An **admin** promotes
> users to instructor / content-manager / admin from the admin panel. The demo accounts
> below cover all four roles.

Build phases, the full API map, the data model and every design decision:
[`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md),
[`docs/IMPLEMENTATION_CHECKLIST.md`](docs/IMPLEMENTATION_CHECKLIST.md),
[`docs/DECISIONS.md`](docs/DECISIONS.md).

## Demo credentials

`npm run seed` (in `backend/`) creates these — password **`Lernexa123!`** for every account:

| Email | Role |
|---|---|
| `admin@lernexa.test` | Admin |
| `cm@lernexa.test` | Content Manager |
| `instructor@lernexa.test` | Instructor (owns ~15 courses, incl. React Fundamentals) |
| `instructor2@lernexa.test` | Instructor (owns ~15 courses, incl. API Design Basics — for the cross-instructor 403 demo) |
| `student@lernexa.test` | Student (pre-enrolled in React Fundamentals, 2 of 4 lessons done, 1 quiz attempt) |
| `blocked@lernexa.test` | Student, **blocked** (for the blocked-login demo) |

Around those six accounts the seed builds a **large, realistic dataset** — ~97 users
across every role, ~61 courses, ~356 lessons, 16 quizzes, ~220 enrolments, ~900
lesson completions, ~35 quiz attempts, 40 blog posts and ~83 audit-log entries,
with deliberate variety and edge cases (empty courses, students with no
enrolments, instructors with no courses, stale drafts, a quiz with an
unanswerable question, …). It is safe to run repeatedly.

- `npm run seed` — build / top up the dataset (idempotent)
- `SEED_SCALE=min npm run seed` — a small dataset for a quick check / CI
- `npm run seed:reset` — wipe seeded data so the next `seed` rebuilds it clean (local only)

Full details: [`backend/scripts/SEED.md`](backend/scripts/SEED.md).

## Tests

```bash
cd backend
npm install

# Pure-function unit tests — no backend needed (grading, progress, progression, reading)
npm test

# Full suite — also runs the integration suites, which need a running, SEEDED backend
npm run seed
RATE_LIMIT_ENABLED=false npm test
#   …or against the deployed API:
TEST_API_URL=https://your.railway.app RATE_LIMIT_ENABLED=false npm test

# 8 authorization checks with curl
bash scripts/verify-auth.sh [BASE_URL]
```

Suites: `permission-matrix`, `auth`, `course-lifecycle`, `blog-lifecycle`, `learning`,
`admin-platform`, `isolation` (integration, hit a running Strapi) and `grading`,
`progress`, `progression`, `reading` (pure functions). Details:
[`backend/tests/README.md`](backend/tests/README.md).

## Known limitations

Documented deliberately (see `docs/DECISIONS.md`):

- No refresh-token rotation — fixed-lifetime JWT; logout clears the cookie but does not revoke server-side.
- Login/register rate limiting is only Strapi's U&P default (10 requests / 60s per IP) — no stricter per-account throttling or lockout.
- No browser / UI E2E tests (Playwright / Cypress). Backend authorization and business logic are covered by integration + pure-function suites (see [Tests](#tests)); the frontend has no component tests — a deliberate trade-off for the timeline.
- No image uploads — cover images are URLs; Railway's filesystem is ephemeral.
- Lesson ordering is a manual integer, not drag-and-drop.
- Quizzes are single-answer MCQ only.
- Search is substring match (`$containsi`), not full-text ranking — fine at this data
  volume; a large corpus would want Postgres `tsvector` or a search service (D-035).

## Theming

Light / dark / system, default system. `data-theme` is set before first paint (no flash),
the choice persists in `localStorage`, and system mode follows the OS with no reload. Every
colour is a token whose value flips between two palettes — one set of components, no
per-theme branching (`docs/DECISIONS.md` D-032).
