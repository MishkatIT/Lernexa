# RBAC.md — Lernexa

**Supersedes v1.** Adds: layer 0 (account state), blocking enforcement chain, expanded
IDOR matrix, settings/audit permissions.

The spec says: *"Getting this 4-role access control right — cleanly, without leaks — is
itself part of what we're evaluating."* This is the highest-priority document in the repo.

## Permission matrix (verbatim from the spec)

| Action | Admin | Content Manager | Instructor | Student |
|---|---|---|---|---|
| Manage users & assign roles | ✅ | ❌ | ❌ | ❌ |
| Create / edit / delete any course | ✅ | ✅ | Own only | ❌ |
| Add / edit / delete lessons | ✅ | ✅ | Own courses | ❌ |
| Create quizzes | ✅ | ✅ | Own courses | ❌ |
| View student progress | ✅ | ✅ | Own courses | Own only |
| Write / manage blog posts | ✅ | ✅ | ❌ | ❌ |
| Enroll in a course | ❌ | ❌ | ❌ | ✅ |
| Take quizzes | ❌ | ❌ | ❌ | ✅ |

Note the ❌s that are easy to miss: **an admin cannot enroll or take quizzes.** "Can do
everything" in the prose is overridden by the matrix. Implement the matrix.

## The governing assumption

**Assume the frontend does not exist.** Every rule below must hold against raw curl
with a valid token. Hidden buttons, client route guards, and disabled inputs are UX.
Strapi is the security boundary.

## Four enforcement layers

Most candidates implement layer 2 and stop.

### Layer 0 — Account state (new)
*"Is this account allowed to act at all, regardless of role?"*

Runs before everything. A blocked user has a role and a valid token and must still be
refused.

### Layer 1 — Authentication
*"Is this a valid, unexpired token?"* — Strapi U&P handles this.

### Layer 2 — Role
*"Can this role invoke this controller action?"* — Users & Permissions plugin.
**Deny by default:** start every custom role at zero permissions, enable only what the
matrix requires. This layer cannot express "own courses only".

### Layer 3 — Resource ownership (route policies)
*"Does this user own this row?"*

```
src/policies/
  is-admin.ts
  has-role.ts              parameterised: ['admin','content-manager']
  is-course-owner.ts       admin/CM pass; instructor must match course.instructor
  is-lesson-owner.ts       lesson → course → instructor
  is-quiz-owner.ts         quiz → course → instructor
  is-enrolled.ts           student must have an Enrollment for the course
```

**Policies protect access-by-id. They do not protect list queries.** That's layer 4.

### Layer 4 — Query scoping (controller-forced filters)
*"What rows can this user see in a collection response?"*

The layer nearly everyone misses, and the one worth demonstrating.

If a student has `find` on enrollments, then `GET /api/enrollments?filters[student][id]=7`
returns **another student's** data. Role check passed. No policy ran — there is no single
resource to own. Data leaked.

```ts
// src/api/enrollment/controllers/enrollment.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::enrollment.enrollment', ({ strapi }) => ({
  async find(ctx) {
    const sanitized = await this.sanitizeQuery(ctx);

    const query = {
      ...sanitized,
      filters: {
        ...(sanitized.filters ?? {}),
        student: { id: { $eq: ctx.state.user.id } },  // LAST. Always last.
      },
    };

    const { results, pagination } = await strapi
      .service('api::enrollment.enrollment').find(query);

    return this.transformResponse(await this.sanitizeOutput(results, ctx), { pagination });
  },
}));
```

Two things worth knowing:

1. **Spread order is the vulnerability.** `{...clientFilters, student: mine}` is safe.
   `{student: mine, ...clientFilters}` lets the client win. One-line difference, total
   compromise. Expect to be asked about this.
2. **This is a known Strapi CVE class.** CVE-2026-27886 (patched 5.37.0) was exactly a
   relational-filtering data leak; 5.37+ adds `strictParam` / `addQueryParams` /
   `addBodyParams` primitives. Pin ≥5.37.0 and know why — but **still force your own
   filters**. Don't outsource your authorization to a framework patch.

Apply layer 4 to: `enrollment`, `lesson-completion`, `quiz-attempt`, `blog-post` (drafts),
`audit-log`, and — for the **instructor** role only — `lesson` and `quiz` reads
(`find` forces `course.instructor = me`; `findOne` runs the owner policy). Without it an
instructor can `GET /api/quizzes/:id` on another instructor's quiz and read the
`isCorrect` answer key. admin / CM stay unscoped.

## Blocking — the full enforcement chain

This is the highest-value security feature in the project, because of the question it
sets up:

> *An admin blocks a student. That student has a valid, unexpired JWT in their cookie.
> What happens on their next request?*

A JWT is stateless. Blocking writes a database row; it does not reach into the browser.
Unless something re-checks account state **per request**, the blocked user keeps working
until token expiry.

### Enforcement points

| # | Where | What |
|---|---|---|
| 1 | Strapi login callback | Already checks `user.blocked === true` and rejects. Built in. |
| 2 | **Strapi global middleware** | Re-reads `blocked` for `ctx.state.user` on every authenticated request → 403 with code `ACCOUNT_BLOCKED`. **The one that matters.** |
| 3 | Next.js | Catches `ACCOUNT_BLOCKED`, clears the session cookie, redirects to `/account-blocked` showing `blockedReason` |
| 4 | Admin UI | Cannot block yourself; cannot block the last remaining admin |

> **Verify point 2 before writing it.** I confirmed Strapi checks `blocked` at *login*.
> I could **not** confirm whether the per-request auth strategy re-checks it. Test:
> block a user, replay their existing token against a protected endpoint. If Strapi
> already handles it, say so in the video and explain why you checked. If it doesn't,
> you found a real gap and closed it. Either outcome is a strong moment — a guess is not.

### Cost of point 2
One extra user read per authenticated request. Acceptable here. At scale you'd cache
blocked-user ids in Redis with a short TTL, or shorten token lifetime and rely on
refresh. **Know this tradeoff** — it's the natural follow-up question.

## The full sensitive-action chain

Every protected action walks this. Write it out for `PUT /api/platform/users/:id/block`
and be able to recite it:

```
authenticated?              → 401
account not blocked?        → 403 ACCOUNT_BLOCKED   (layer 0)
role == admin?              → 403                   (layer 2)
target user exists?         → 404
target != self?             → 400 "cannot block yourself"
target not last admin?      → 400 "cannot block the last admin"
valid state transition?     → 400 (already blocked)
perform + audit.record()    → 200
```

Not: `if (isAdmin) showButton`.

## Endpoint permission table

| Endpoint | admin | CM | instructor | student | public |
|---|---|---|---|---|---|
| `GET /api/courses` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/courses` | ✅ | ✅ | ✅ owner forced | ❌ | ❌ |
| `PUT\|DELETE /api/courses/:id` | ✅ | ✅ | ✅ own only | ❌ | ❌ |
| `GET /api/lessons` \| `/api/lessons/:id` | ✅ | ✅ | ✅ own course | ❌ | ❌ |
| `POST\|PUT\|DELETE /api/lessons` | ✅ | ✅ | ✅ own course | ❌ | ❌ |
| `GET /api/quizzes` \| `/api/quizzes/:id` | ✅ | ✅ | ✅ own course | **❌ disabled** | ❌ |
| `POST\|PUT\|DELETE /api/quizzes` | ✅ | ✅ | ✅ own course | ❌ | ❌ |
| `GET /api/quizzes/:id/take` | ❌ | ❌ | ❌ | ✅ enrolled | ❌ |
| `POST /api/quizzes/:id/submit` | ❌ | ❌ | ❌ | ✅ enrolled | ❌ |
| `POST /api/enrollments/enroll` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `GET /api/enrollments/me` | ❌ | ❌ | ❌ | ✅ scoped | ❌ |
| `GET /api/courses/:id/learn` | ❌ | ❌ | ❌ | ✅ enrolled | ❌ |
| `POST /api/lesson-completions/complete` | ❌ | ❌ | ❌ | ✅ enrolled | ❌ |
| `GET /api/courses/:id/student-progress` | ✅ | ✅ | ✅ own course | ❌ | ❌ |
| `GET /api/blog-posts` (published) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/blog-posts?status=draft` | ✅ | ✅ own | ❌ | ❌ | ❌ |
| `POST\|PUT\|DELETE /api/blog-posts` | ✅ any | ✅ | ❌ | ❌ | ❌ |
| `GET /api/platform/*` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `PUT /api/platform/users/:id/role` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `PUT /api/platform/users/:id/block` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/site-settings` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PUT /api/site-settings` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /api/audit-logs` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST\|PUT\|DELETE /api/audit-logs` | **❌ nobody** | ❌ | ❌ | ❌ | ❌ |

**Also disable for every non-admin role:** the U&P defaults `GET /api/users` and
`PUT /api/users/:id`. Left on, a student enumerates every user, and `PUT` with a `role`
in the body is straight privilege escalation. These are on by default in some
configurations — check explicitly.

**Audit log has no write endpoint at all.** Entries are created only by the internal
`audit.record()` service. An audit log an admin can edit is not an audit log.

## IDOR / isolation matrix

| Attack | Expected | Enforced by |
|---|---|---|
| Instructor A edits Instructor B's course | 403 | layer 3 `is-course-owner` |
| Instructor A adds a lesson to B's course | 403 | layer 3, resolved through course |
| Instructor A views B's students' progress | 403 | layer 3 on the progress route |
| Instructor A reads B's quiz answer key (`GET /api/quizzes/:id`) | 403 | layer 3 `is-quiz-owner` on findOne |
| Instructor A lists/reads lessons in B's course | 0 results / 403 | layer 4 forced filter + `is-lesson-owner` |
| Student X reads Student Y's enrollments via `filters` | own rows only | layer 4 forced filter |
| Student X reads Student Y's quiz attempts | own rows only | layer 4 |
| Student X submits a quiz as Student Y | ignored | id from `ctx.state.user`, never the body |
| Student marks complete in a course they never enrolled in | 403 | `is-enrolled` |
| Student POSTs `{ progress: 100 }` | no such field | derived-not-stored model |
| Student reads quiz correct answers | not exposed | `find`/`findOne` disabled + `toStudentQuiz()` |
| Anonymous lists blog drafts | 0 results | D&P + forced filter |
| Content Manager opens `/admin` | 403 | `is-admin` |
| Instructor promotes self to admin | 403 | `PUT /api/users/:id` disabled for non-admins |
| New signup requests `role: admin` | created as student | role stripped + zod allowlist |
| **Blocked user with a valid token acts** | 403 `ACCOUNT_BLOCKED` | layer 0 middleware |
| **Admin blocks themselves** | 400 | controller guard |
| **Admin demotes/blocks the last admin** | 400 | count admins first |
| Non-admin writes site settings | 403 | layer 2 |
| Anyone writes an audit entry | 404 (no route) | no write endpoint exists |
| Client requests `pageSize=100000` | clamped to 100 | server-side max, see PERFORMANCE.md |

## Three server-side invariants

State these out loud in the video:

1. **Identity comes from the token, never the body.** `ctx.state.user.id` is the only
   source of "who is this". Any `userId` / `studentId` / `authorId` in a body is ignored.
2. **Ownership filters are set by the server, never merged from the client.**
3. **Grades and progress are computed server-side.** The client sends selections; the
   server sends a score.

## Frontend's role

`middleware.ts` cannot verify the Strapi JWT signature — the secret lives in Strapi. It
does presence checks and redirects only. Role gating in layouts uses `getCurrentUser()`,
which asks Strapi. **Strapi is the arbiter.** Say this explicitly in the video, then
prove it with curl.

## Verification script

`backend/scripts/verify-auth.sh`, run against the **deployed Railway URL**, shown in the
video:

```bash
# 1. student POSTs /api/courses                        → 403
# 2. instructor2 PUTs instructor1's course             → 403
# 3. student GETs /api/quizzes/1                       → 403 (disabled)
# 4. student GETs enrollments?filters[student][id]=N   → own rows only
# 5. anonymous GETs blog drafts                        → 0 results
# 6. content-manager GETs /api/platform/stats          → 403
# 7. signup with role:admin in body                    → created as student
# 8. blocked user replays a valid token                → 403 ACCOUNT_BLOCKED
```

Thirty seconds of this does more for your evaluation than five minutes of clicking. It
is the literal answer to *"enforce this on the backend, not just by hiding buttons."*

## `permission-matrix.test.ts`

Encode the matrix as data so a reviewer can diff your tests against the PDF in seconds.

```ts
const CASES = [
  { role: 'student',    method: 'POST', path: '/api/courses',         expect: 403 },
  { role: 'instructor', method: 'PUT',  path: '/api/courses/{other}', expect: 403 },
  { role: 'instructor', method: 'PUT',  path: '/api/courses/{own}',   expect: 200 },
  { role: 'content-manager', method: 'GET', path: '/api/platform/stats', expect: 403 },
  { role: 'blocked',    method: 'GET',  path: '/api/enrollments/me',  expect: 403 },
  // …one row per meaningful cell
];

describe.each(CASES)('$role $method $path', ({ role, method, path, expect: status }) => {
  it(`→ ${status}`, async () => { /* request with that role's JWT */ });
});
```
