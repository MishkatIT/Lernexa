# AI_HANDOFF.md — Lernexa

Persistent context for Claude Code working in this repository.

Root `CLAUDE.md` should contain:
```
Read docs/AI_HANDOFF.md before doing anything.
Then read docs/PROJECT_PLAN.md, ARCHITECTURE.md, DATA_MODEL.md, RBAC.md,
PERFORMANCE.md, DESIGN_SYSTEM.md, ADMIN_PANEL.md, IMPLEMENTATION_CHECKLIST.md,
DECISIONS.md.
Current phase: see IMPLEMENTATION_CHECKLIST.md — work the lowest unchecked phase.
```

---

## What we are building

**Lernexa** — a Learning Management System. Next.js on Vercel, Strapi 5 on Railway,
PostgreSQL. Four roles: admin, content-manager, instructor, student.

**Product thesis:** progress, not catalogue. Every screen answers "where am I?" before
"what's available?"

## The context that governs everything

This is a project submission evaluated by a human engineer who reads the code and watches a 10-minute video in which the author explains it line by line.

**The author must understand every line.** Code the author cannot explain is worse than
no code. Optimise for explainability over cleverness, always.

## Rules of engagement

1. **One phase at a time**, per IMPLEMENTATION_CHECKLIST.md. Read the relevant docs and
   inspect existing code before starting. Do not skip ahead. Do not implement Phase 6
   while asked for Phase 3.
2. **Stop and explain before writing security-relevant code.** Policies, controller
   overrides, session handling, grading, the blocking middleware: explain the approach
   in prose, get agreement, then write.
3. **No unrequested features. Scope is frozen as of the v3 review.** If something seems
   missing, say so; don't build it. Check PROJECT_PLAN.md Tier 4 and DECISIONS.md
   D-011 and D-020…D-028 first — twenty-plus capabilities were evaluated and rejected
   deliberately, with reasons. A Tier 4 entry is a decision, not an oversight.

   If the author asks mid-implementation for something in Tier 4, say which decision
   covers it and what it would cost against the remaining time, then let them choose.
4. **Prefer boring, explicit code.** Three near-identical controller overrides that each
   read clearly beat one generic factory the author can't defend under questioning.
5. **No new dependencies without asking.** Current set: Next.js, React, Tailwind, zod,
   `server-only`, IBM Plex via `next/font`, Strapi. Anything else, ask.
6. **After each phase, output a short summary** in language the author can reuse in the
   video.
7. **Flag genuine uncertainty.** Version details in ARCHITECTURE.md may be stale. If a Strapi 5 API surface may have changed, say so and
   point at the docs rather than guessing.
8. **When the plan is wrong, say so.** These docs are a plan, not scripture. If
   something won't work, raise it before building it.

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
- **The author can explain the data flow out loud**

## Ask, don't decide

- Any deviation from DATA_MODEL.md
- Any new npm package
- Anything changing auth or session
- Any tradeoff worth a DECISIONS.md entry
- Anything taking more than ~90 minutes
- Any visual choice not covered by DESIGN_SYSTEM.md

## If time runs short

Follow the cut list in PROJECT_PLAN.md, top-down. **Never cut** backend authorization,
server-side grading, progress accuracy, deployment, or seed data.

If a phase is running long, **say so and propose what to drop** rather than silently
shipping something half-finished.

## Open items requiring empirical verification

Do not assume either answer. Test and record the result:

1. **Does Strapi's per-request auth strategy re-check `user.blocked`?** Confirmed only
   for the login path. Block a user, replay their existing token, observe.
2. **Strapi 5's draft query parameter** — `status=draft` expected, `publicationState` in
   v4. Confirm for the installed version, then test from an anonymous session.
3. **Link-table names and columns** for the index migration. Inspect the generated schema;
   do not copy names from any document.
4. **Whether Strapi's relation delete cascades** `LessonCompletion` when a lesson is
   deleted. If not, add explicit cleanup.
5. **Exact Strapi production env var list** for the installed version.
