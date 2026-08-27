# ARCHITECTURE.md

## Versions (verify before `npm install`)

Confirm against official docs before pinning.

- **Strapi 5.x** — latest is ~5.50.x. Strapi 4 is **End of Life**. Do not start on v4.
  - **Pin ≥ 5.37.0 minimum.** Versions below it are affected by CVE-2026-27886 (data leak via relational filtering) and CVE-2026-22599 (SQL injection in Content-Type Builder). Use the latest 5.x.
- **Next.js 16.x** — use 16.3.3+ (contains critical security fixes). Next.js 15 is Maintenance LTS until Oct 2026.
- **PostgreSQL** on Railway. **Not SQLite** — Railway's container filesystem is ephemeral; a SQLite file is destroyed on every redeploy.
- Node: whatever the Strapi 5 docs currently require. Pin it in `.nvmrc` and in `engines`.

## The one-sentence architecture

Strapi is the security boundary and the only thing that touches the database;
Next.js is a server-rendered client that holds the session cookie and never exposes the JWT to the browser.

## Layer diagram

```
Browser
  │  httpOnly cookie: lms_session (contains Strapi JWT)
  │  no JWT in JS, no JWT in localStorage
  ▼
Next.js on Vercel  ──────────────────────────────────────────┐
  ├─ middleware.ts        coarse auth gate (UX only)          │
  ├─ Server Components    read cookie → call Strapi w/ Bearer │
  ├─ Server Actions       mutations → call Strapi w/ Bearer   │
  └─ /api/auth/*          login/signup/logout, sets cookie    │
  │                                                            │
  │  Authorization: Bearer <jwt>   (server-to-server, HTTPS)   │
  ▼                                                            │
Strapi 5 on Railway  ← THE SECURITY BOUNDARY ──────────────────┘
  ├─ Users & Permissions plugin   role-level: can this role call this action?
  ├─ Route policies               resource-level: does this user own this row?
  ├─ Custom controllers           forces owner filters, sanitizes output
  └─ Services                     pure business logic (grading, progress)
  ▼
PostgreSQL (Railway)
```

## Why the BFF (Backend-for-Frontend) cookie pattern

The default Strapi tutorial stores the JWT in `localStorage`. That is the single most
common weakness in submissions for this kind of round.

**Chosen:** Next.js route handler receives credentials → calls Strapi `/api/auth/local`
→ receives JWT → sets it in an `httpOnly; Secure; SameSite=Lax` cookie scoped to the
Vercel domain. The browser never sees the token.

| | localStorage | httpOnly cookie (chosen) |
|---|---|---|
| XSS steals token | Yes, trivially | No, JS cannot read it |
| CSRF risk | No | Yes — mitigated by SameSite=Lax + POST-only mutations |
| Works in Server Components | No | Yes |
| Complexity | Lower | Slightly higher |

The cookie is first-party to the Vercel domain, so `SameSite=Lax` is not a cross-site
problem — the Strapi call happens server-side with an `Authorization` header, not from
the browser.

**Critical rule:** the Next.js server layer must never become a generic proxy that
forwards arbitrary paths and bodies to Strapi. That would move the security boundary
into Vercel and defeat the spec's requirement. Each Server Action calls one specific,
narrow Strapi endpoint.

## Request flow — "student marks a lesson complete"

Use this as the "data flow" segment of the video.

1. Client component calls Server Action `markLessonComplete(lessonId)`
2. Action reads `lms_session` cookie via `cookies()`
3. Action `POST /api/lesson-completions/complete` to Strapi with `Bearer <jwt>`, body `{ lessonId }`
4. Strapi route matches → `global::is-student` policy → 403 if role isn't student
5. Controller resolves `ctx.state.user.id`. **Never reads a userId from the body.**
6. Controller loads the lesson → its course → checks an Enrollment exists for (user, course). 403 if not.
7. Controller upserts a `LessonCompletion` row for (user, lesson). Idempotent.
8. Service `computeProgress(courseId, userId)` returns `{ completed, total, percent }`
9. Response returned; Server Action calls `revalidatePath()`; UI re-renders

Note what is *not* in the flow: the client never sends a percentage, a userId, or a
completion count. It sends one id. Everything else is derived server-side.

## Repository layout

One repo. The submission form asks for one GitHub link.

```
lms/
├── README.md                 ← run instructions, feature list, demo credentials
├── CLAUDE.md                 ← pointer to docs/AI_HANDOFF.md
├── .gitignore
├── docs/
│   ├── PROJECT_PLAN.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── RBAC.md
│   ├── IMPLEMENTATION_CHECKLIST.md
│   ├── DECISIONS.md
│   └── AI_HANDOFF.md
├── backend/                  ← Strapi 5.  Railway root directory = backend
│   ├── src/
│   │   ├── api/
│   │   │   ├── course/{content-types,controllers,routes,services}
│   │   │   ├── lesson/
│   │   │   ├── enrollment/
│   │   │   ├── lesson-completion/
│   │   │   ├── quiz/
│   │   │   ├── quiz-attempt/
│   │   │   ├── blog-post/
│   │   │   └── platform/          ← custom: /api/platform/stats, admin user mgmt
│   │   ├── components/quiz/{question,option}.json
│   │   ├── policies/              ← global policies (is-admin, is-owner, …)
│   │   ├── extensions/users-permissions/
│   │   └── index.ts               ← bootstrap: ensure roles exist
│   ├── scripts/seed.ts
│   ├── tests/
│   │   ├── permission-matrix.test.ts
│   │   ├── grading.test.ts
│   │   └── progress.test.ts
│   └── config/{database,middlewares,server,plugins}.ts
└── frontend/                 ← Next.js 16.  Vercel root directory = frontend
    └── src/
        ├── app/
        │   ├── (public)/          courses, blog, login, register
        │   ├── (student)/         my-courses, learn/[courseId]/[lessonId], quiz
        │   ├── (manage)/          instructor + content-manager dashboards
        │   ├── (admin)/           admin panel
        │   └── api/auth/{login,register,logout}/route.ts
        ├── lib/
        │   ├── strapi.ts          server-only fetch wrapper, attaches Bearer
        │   ├── session.ts         cookie read/write, getCurrentUser()
        │   └── schemas.ts         zod schemas shared by forms + actions
        ├── actions/               Server Actions, one file per domain
        ├── components/
        └── middleware.ts
```

## Frontend structure decisions

- **App Router, Server Components by default.** Client components only where there is
  real interactivity: quiz form, mark-complete button, role dropdown.
- **Route groups** map to audiences, not to roles-as-folders. `(manage)` covers both
  instructor and content-manager because their pages are the same shape with different
  data scoping.
- **`middleware.ts` is UX, not security.** It checks that the session cookie exists and
  redirects to `/login` if not. It must not be trusted for role checks — you cannot
  verify the Strapi JWT signature there without sharing the secret. Real role gating
  happens in layouts via `getCurrentUser()` (which asks Strapi), and the real
  enforcement happens in Strapi.
- **`lib/strapi.ts` is `server-only`.** Import the `server-only` package so a client
  component importing it fails at build time. This is a cheap, strong guard.
- **Mutations are Server Actions**, not client `fetch`. This keeps the token server-side
  and gives you `revalidatePath` for free.
- **`getCurrentUser()` wrapped in React `cache()`** so multiple layouts in one render
  pass don't each hit `/api/users/me`.

## Error handling

| Layer | Approach |
|---|---|
| Strapi | Throw `ForbiddenError` / `NotFoundError` / `ValidationError` from `@strapi/utils`. Never leak "course not found for user X". |
| Strapi 404 vs 403 | Return **403** when the resource exists but isn't yours (honest, and simpler to reason about). Document this choice. |
| Server Actions | Return `{ ok: false, error }` shapes. Do not throw raw errors into the UI. |
| Next.js routes | `error.tsx` per route group, `not-found.tsx`, a dedicated `/forbidden` page that explains what role is needed. |
| Forms | zod on both sides. Client for UX, server action re-validates. Never trust client validation. |

## Deployment

### Railway (Strapi)
- Add a **Postgres** service; Railway injects `DATABASE_URL`.
- Set root directory to `backend/`.
- Required env (verify exact list against the Strapi 5 docs for your version):
  `DATABASE_URL`, `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`,
  `JWT_SECRET`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT` (Railway provides).
- Generate every secret fresh. Do not reuse the ones Strapi prints in dev.
- Build: `npm run build` then `npm run start`.
- Configure CORS in `config/middlewares.ts` to allow the Vercel origin.

### Vercel (Next.js)
- Root directory `frontend/`.
- `STRAPI_URL` — server-side only, **not** `NEXT_PUBLIC_`. Nothing in the browser
  needs to know the Strapi URL under this architecture.
- `SESSION_COOKIE_NAME`, and any cookie-signing secret.

### Order of operations
Deploy both on **day one** with a hello-world. Deployment problems discovered on
Sunday afternoon are how people fail this round. CORS, env vars, Postgres SSL, and
Railway's root-directory setting all fail in ways that eat hours.

### Uptime
The spec requires the app to stay live until interviews are over. Check your Railway
plan's resource/credit behaviour — I can't tell you current Railway pricing reliably,
verify it yourself. Set a calendar reminder to check both URLs every few days.

## Testing strategy

Realistic for 4 days. Prioritised by signal-per-hour.

1. **`permission-matrix.test.ts` (highest value).** Table-driven. Encode the PDF's
   permission matrix literally as data, get a JWT per role, assert status codes.
   This is the artifact that makes a reviewer trust your RBAC in 30 seconds.
2. **`grading.test.ts`** — `gradeQuiz()` as a pure function. Cases: all correct, all
   wrong, partial, missing answer, unknown option id, quiz with zero questions.
3. **`progress.test.ts`** — `computeProgress()` pure. Cases: 0 lessons (division by
   zero), 0 completed, all completed, completed lesson later deleted.
4. **Manual curl script** (`scripts/verify-auth.sh`) that runs the top 6 attack cases
   against the deployed API. Use it in the video.
5. Frontend component tests: **skip**. Say so in the README with a reason. An honest
   "I prioritised authorization tests over component tests given the timeline" reads
   better than three trivial render tests.

Extracting `gradeQuiz` and `computeProgress` into `src/api/*/services/` as pure
functions taking plain data — not `ctx` — is what makes them testable. That
refactor is itself the thing being evaluated.
