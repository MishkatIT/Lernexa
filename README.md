# Lernexa

A Learning Management System built around one idea: **progress, not catalogue.**
Every screen answers *"where am I?"* before *"what's available?"*

- **Frontend:** Next.js 16 (App Router, Server Components) on Vercel
- **Backend:** Strapi 5 (TypeScript) on Railway
- **Database:** PostgreSQL

Strapi is the security boundary and the only thing that touches the database. Next.js is
a server-rendered client that holds the session cookie and never exposes the JWT to the
browser.

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

Tracked against `docs/IMPLEMENTATION_CHECKLIST.md`.

- [x] **Phase 0** — Monorepo + deploy skeleton _(both apps live on Railway + Vercel)_
- [x] **Phase 1** — Brand + content types _(data model, four roles, IBM Plex + design tokens)_
- [x] **Phase 2** — Auth + session _(httpOnly cookie, forced student role, role-aware redirect)_
- [x] **Phase 3** — Courses, lessons, ownership _(4 enforcement layers, forced owner on create, 409 delete guards)_
- [x] **Phase 4** — Enrollment, learning, progress _(derived progress, batched instructor table, lesson viewer, `progress.test.ts`)_
- [x] **Phase 5** — Quiz + server-side grading _(isCorrect never leaves the server, pure gradeQuiz, snapshot attempts, grading.test.ts)_
- [x] **Phase 6** — Admin panel + user blocking _(platform API, per-request block check, registrationEnabled gate, attention queue)_
- [x] **Phase 7** — Blog, tests, seed _(published-only public blog, permission-matrix.test.ts, verify-auth.sh, idempotent seed)_
- [x] **Phase 8** — Polish _(error / not-found / forbidden states, loading skeletons, toasts, README)_ · ship pending
- [x] **Review pass** — audit log, instructor catalogue scope forced in the controller (D-034),
  site-wide debounced server-side search (D-035), pagination-independent counts (D-036),
  self-contained quiz-attempt review snapshot + `/results` page (D-037), second query-index migration

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
npm test                                   # vitest: grading + progress + permission matrix
TEST_API_URL=https://your.railway.app npm test   # run the matrix against production
bash scripts/verify-auth.sh [BASE_URL]      # 9 authorization checks with curl
```

## Known limitations

Documented deliberately (see `docs/DECISIONS.md`):

- No refresh-token rotation — fixed-lifetime JWT; logout clears the cookie but does not revoke server-side.
- Login/register rate limiting is only Strapi's U&P default (10 requests / 60s per IP) — no stricter per-account throttling or lockout.
- No E2E tests — backend authorization and business-logic unit tests were prioritised for the timeline.
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
