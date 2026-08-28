# ENGINEERING.md — Lernexa

Engineering context for this repository. Read alongside `PROJECT_PLAN.md`,
`ARCHITECTURE.md`, `DATA_MODEL.md`, `RBAC.md`, `PERFORMANCE.md`,
`DESIGN_SYSTEM.md`, `ADMIN_PANEL.md`, `IMPLEMENTATION_CHECKLIST.md`, and
`DECISIONS.md`.

## What we are building

**Lernexa** — a learning platform. Next.js on Vercel, Strapi 5 on Railway,
PostgreSQL. Four roles: admin, content-manager, instructor, student.

**Product thesis:** progress, not catalogue. Every screen answers "where am I?" before
"what's available?"

## Engineering principles

1. **One phase at a time**, per IMPLEMENTATION_CHECKLIST.md. Inspect existing code
   before starting a phase; don't skip ahead.
2. **Prefer boring, explicit code.** Three near-identical controller overrides that
   each read clearly beat one generic factory that's hard to defend.
3. **Scope is deliberate.** PROJECT_PLAN.md Tier 4 and DECISIONS.md D-011 and
   D-020…D-028 record capabilities that were evaluated and rejected on purpose. A
   Tier 4 entry is a decision, not an oversight.
4. **Dependency set is small:** Next.js, React, Tailwind, zod, `server-only`, IBM
   Plex via `next/font`, Strapi (+ `vitest` for tests). Add nothing else without a
   reason.
5. **Version details in ARCHITECTURE.md may drift.** When a Strapi 5 API surface
   looks changed, check the docs rather than guessing.

## Hard prohibitions

Never, even under time pressure:

- Read a user/student/author id from a **request body**. Identity is `ctx.state.user` only.
- Merge client filters over server-forced ownership filters. **Forced filter goes last.**
- Return `isCorrect` to a student endpoint, or pass a populated quiz into a client component.
- Store a computed progress percentage.
- Grade a quiz on the client.
- Put the JWT in localStorage, sessionStorage, or a non-httpOnly cookie.
- Expose `STRAPI_URL` or any secret via `NEXT_PUBLIC_`.
- Use `populate=*` or `populate=deep` anywhere.
- Call `computeProgress` in a loop over students. Use the batched service.
- Return an unpaginated list from any collection endpoint.
- Cache anything user-scoped.
- Enforce a permission only in the UI.
- Enable U&P defaults `GET /api/users` or `PUT /api/users/:id` for non-admin roles.
- Create write endpoints for the audit log.
- Commit `.env` files or real secrets.
- Squash history, rewrite commits to look incremental, or make one large commit.
- **Add a `deletedAt` / soft-delete column to anything.** Deletion refuses with 409 when
  dependents exist. See D-020 — this was evaluated and rejected on purpose.
- **Add any scheduled job, cron, or background worker.** No retention, no cleanup, no
  scheduled publishing. See D-021 and D-024.
- **Add a notification, email, or messaging capability.** See D-023.
- **Add a review/approval state to any publishing flow.** No reviewer role exists in the
  permission matrix; adding one invents a requirement. See D-025.
- Build the global banner. `registrationEnabled` only. See D-026.

## Conventions

**TypeScript** both apps. No `any` in security-relevant code.

**Strapi**
- Custom logic in `src/api/<name>/{controllers,routes,services,policies}`
- Reusable policies in `src/policies/`, referenced `global::policy-name`
- **Business logic in services as pure functions taking plain data, never `ctx`.**
  `gradeQuiz(quiz, submission)` and `computeProgress(lessons, completions)` must be
  unit-testable without booting Strapi. This is deliberate — it's what makes the tests
  possible and what gets discussed in the interview.
- Every controller override: `sanitizeQuery` → service → `sanitizeOutput` →
  `transformResponse`. Never skip a step.
- Throw `ForbiddenError` / `NotFoundError` / `ValidationError` from `@strapi/utils`
- Every list endpoint clamps `pageSize` to its documented max

**Next.js**
- Server Components by default; `'use client'` only for real interactivity
- Mutations via Server Actions in `src/actions/`, never client `fetch` to Strapi
- `src/lib/strapi.ts` imports `server-only`
- zod schemas in `src/lib/schemas.ts`, used by both form and action
- Independent fetches in `Promise.all`, never sequential awaits
- `revalidatePath` / `revalidateTag` after mutations

**Design** — follow DESIGN_SYSTEM.md exactly. In particular:
- Radius is **4px**, one value, everywhere
- Elevation is **borders**, not shadows (one shadow exists, for modals)
- Green means **completed** and nothing else
- No gradients, no glassmorphism, no icon-in-tinted-circle stat card grids
- If a visual choice isn't justified in DESIGN_SYSTEM.md, ask before adding it

**Commits**
- Conventional Commits, scoped
- One logical change each
- A *why* body on anything non-obvious
- **Target 8 to 10 commits total for the entire project** — ideally, group your work and commit once per major phase.

## Definition of done

- Works against the **deployed** Strapi, not localhost
- Authorization verified with curl
- Edge cases from the relevant doc handled
- Committed with a meaningful message
- The data flow is explainable end to end

## Changes that need a decision recorded

- Any deviation from DATA_MODEL.md
- Any new npm package
- Anything changing auth or session
- Any tradeoff worth a DECISIONS.md entry
- Any visual choice not covered by DESIGN_SYSTEM.md

## If time runs short

Follow the cut list in PROJECT_PLAN.md, top-down. **Never cut** backend authorization,
server-side grading, progress accuracy, deployment, or seed data.

## Open items requiring empirical verification

Test and record the result rather than assuming:

1. **Does Strapi's per-request auth strategy re-check `user.blocked`?** Confirmed only
   for the login path. Block a user, replay their existing token, observe.
2. **Strapi 5's draft query parameter** — `status=draft` expected, `publicationState` in
   v4. Confirm for the installed version, then test from an anonymous session.
3. **Link-table names and columns** for the index migration. Inspect the generated schema;
   do not copy names from any document.
4. **Whether Strapi's relation delete cascades** `LessonCompletion` when a lesson is
   deleted. If not, add explicit cleanup.
5. **Exact Strapi production env var list** for the installed version.
