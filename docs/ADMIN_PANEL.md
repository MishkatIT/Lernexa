# ADMIN_PANEL.md — Lernexa

Covers admin capabilities, platform settings, the global banner, and the audit log.
Absorbs what would otherwise be a separate PLATFORM_SETTINGS.md — one surface, one doc.

## Principle

The admin panel is not CRUD with extra permissions. It answers **"what needs my
attention?"** and gives safe controls to act on the answer.

Every capability below follows the same shape:

```
authenticated → not blocked → is admin → target valid
→ state transition allowed → business guard → act → audit
```

Not: `if (isAdmin) showButton`.

## Scope decisions (what's in and what's out)

| Capability | Verdict | Reason |
|---|---|---|
| User list, search, filter, paginate | **Build** | Core admin need. Cheap. |
| Change user role | **Build** | Explicitly required by the spec. |
| Block / unblock user | **Build** | Best security signal in the project — see below. |
| Platform stats | **Build** | Required by the spec. |
| Cross-platform content management | **Build** | Required by the spec. |
| Audit log | Tier 3 | Cheap once blocking exists; the *immutability* argument is the value. |
| `registrationEnabled` setting | **Build** (Tier 2.5) | 20 min, and a strong video beat — disable it, curl register, get 403. |
| Global banner | **Deferred to Tier 4** | ~3h for "an admin can display a message." Thin engineering content. Those hours buy two video rehearsals (D-026). |
| **Soft delete + Trash** | **Skip** | Every query in the system needs a `deletedAt` filter; collides with forced-ownership filters. Replaced by delete guards (D-020). |
| **Retention / auto cleanup** | **Skip** | Unmonitored scheduled deletion against a deployment that must stay live. All downside (D-024). |
| **Revision history** | **Skip** | A subsystem, not a feature (D-022). |
| **Notifications** | **Skip** | Multi-day delivery infrastructure; no notifiable events at demo scale (D-023). |
| **Separate "suspend" vs "block"** | **Skip** | Two names, one enforcement path, no product value. One `blocked` state with a reason is cleaner and defensible. |
| **Maintenance mode** | **Skip** | Highest risk, lowest marginal signal. A bug takes down the deployment the spec requires to stay live. If built: last, with an env-var escape hatch, verified **off** before submission. |
| Logo/favicon upload | **Skip** | Railway's filesystem is ephemeral. |
| Delete users | **Skip** | Cascading deletes across enrollments, completions and attempts is a data-integrity minefield. Blocking achieves the operational goal. **Say this if asked — it's a considered decision, not an oversight.** |
| Impersonate user | **Skip** | Genuinely useful in production, genuinely dangerous, and impossible to secure properly in a day. |

## Blocking

### Why this feature earns its place

Not because "admins need to ban people." Because of the question it sets up:

> *An admin blocks a student. That student has a valid, unexpired JWT in their cookie.
> What happens on their next request?*

Most junior candidates cannot answer that. Building the fix — a global middleware that
re-checks account state per request — is ~20 lines and demonstrates real understanding
of stateless auth. Full enforcement chain in RBAC.md.

### Data
Uses Strapi's built-in `blocked` boolean plus `blockedReason`, `blockedAt`, `blockedBy`.
Not a custom enum: Strapi's login callback already checks `blocked` and rejects with
"Your account has been blocked by an administrator", so the login path is free.

### Guards on `PUT /api/platform/users/:id/block`
- Target exists → else 404
- Target ≠ self → 400 "You cannot block your own account"
- Target is not the **last unblocked admin** → 400 (count first)
- State actually changes → 400 if already in that state
- `reason` required when blocking, max 500 chars
- On success → `audit.record('user.blocked', …)`

### UX
Modal requiring a typed reason. The confirm button says **"Block Sara Ahmed"**, not
"Confirm" — naming the consequence prevents mis-clicks. The reason is shown to the
blocked user on the `/account-blocked` page; a block with no explanation is bad product
design.

Self and last-admin rows have the action disabled in the UI **and** rejected by the
backend. The disabled button is UX; the 400 is the rule. Demonstrate both.

## Role change

`PUT /api/platform/users/:id/role`

Guards: target exists (404) · role is one of the four (400) · not self-demotion (400)
· not last-admin demotion (400) · audit on success.

**Self-demotion and last-admin guards matter more than they look.** Without them the
platform can reach zero admins with no recovery path. Fifteen minutes of work, and
exactly the "did you think about…" question an interviewer asks.

UI: inline select → confirm modal stating "Change Rafi Hasan from Student to
Instructor". Not a silent save.

## Platform statistics

Only metrics that change an admin's behaviour. No vanity numbers.

| Metric | Why it's useful | Query |
|---|---|---|
| Total users, and per role | Is the role mix sane? | 1 count + 4 filtered counts |
| Blocked users | Moderation load | 1 filtered count |
| **Users active in last 7 days** | Real engagement | `distinct student` from `lesson_completion` where `completedAt > now-7d` |
| Total courses | Catalogue size | 1 count |
| Courses with no lessons | **Actionable** — broken content | 1 count with a relation filter |
| Total enrollments | Demand | 1 count |
| Average course completion % | Is anyone finishing? | derived from 2 aggregates |
| Quiz attempts + average score | Are quizzes too hard? | 1 count + 1 avg |
| Blog: published vs drafts | Content pipeline | 2 counts |

**Deliberately excluded:** page views, session duration, "growth %" against no baseline.
Numbers that look impressive and inform nothing.

**"Active users" is redefined** as *users with a lesson completion in the last 7 days*.
True active-user tracking needs a write on every request; this reuses data you already
have for zero additional writes. Say that on camera — redefining a metric to avoid an
expensive mechanism is a real engineering decision.

### Performance
All counts in one `Promise.all`, cached 60s under tag `platform-stats`. Details in
PERFORMANCE.md. Eight sequential awaits on a dashboard is the exact mistake a reviewer
looks for.

## Cross-platform content management

Admin sees all courses, lessons, quizzes and blog posts regardless of owner, with the
same components the owners use — different query scope, not a different UI.

Boundaries that still apply to admins:
- Deleting a course with enrollments requires confirmation naming the count:
  "Delete 'React Basics'? 23 students are enrolled."
- Publishing/unpublishing someone else's blog post is audited
- **Admin cannot enroll or take quizzes.** The spec's matrix says ❌. "Can do
  everything" in the prose does not override the matrix. Implement the matrix, and be
  ready to point at it if questioned — noticing this is a comprehension signal.

## Site settings — Strapi **Single Type**

You wanted "a typed configuration model, not an arbitrary key/value table." Strapi
Single Types **are** that: one row, schema-validated, typed, with a generated admin UI.
A `settings` KV table would be the anti-pattern.

Fields in DATA_MODEL.md. Deliberately small: site name, registration toggle, and the
banner group. Nothing else, because nothing else would be read.

**`registrationEnabled: false` must be enforced in the register controller**, not by
hiding the signup link. Test it with curl.

**Read is public** (the banner renders for logged-out visitors); **write is admin-only.**

## Global banner

Storage: the settings Single Type. No separate content type — announcements here are
singular and ephemeral, not a collection with history.

| Concern | Approach |
|---|---|
| Backend authz | Public `find`, admin-only `update` |
| Caching | `unstable_cache` tag `site-settings`; `revalidateTag` on update |
| Retrieval | Root layout Server Component, so it's in the first paint |
| Dismissal | **Cookie keyed by settings `updatedAt`** — readable during SSR, so no flash of an already-dismissed banner. New banner ⇒ new key ⇒ reappears. |
| Mobile | Wraps to two lines; dismiss stays right-aligned at ≥44px tap target |
| Severity | `info` / `warning` / `critical` → left border colour + tone |

The `updatedAt`-keyed dismissal is a small detail that shows you thought past the happy
path. localStorage would work but flashes on every SSR load — worth one sentence on
camera.

## Audit log (Tier 3)

### The single design decision that matters

**Append-only. No update or delete endpoint exists — not for admins, not for anyone.**
An audit log an admin can edit is not an audit log. Enforce by simply not creating the
routes; entries are written only by the internal `audit.record()` service.

That sentence is the reason to build this feature at all.

### Events logged
`role.changed` · `user.blocked` · `user.unblocked` · `settings.updated` ·
`blog.published` · `course.deleted`

Not logged: reads, logins, ordinary content edits. Logging everything produces a feed
nobody reads and a table that outgrows the data it describes.

### Shape
Actor · action · targetType · targetId · **targetLabel** · metadata · createdAt.

`targetLabel` is denormalised deliberately — "Role changed for user 47" is useless once
user 47 is gone. Small, defensible denormalisation, and a good thing to be asked about.

### Written explicitly, not by middleware
`audit.record()` is called from admin controllers at known call sites. A middleware that
logs everything automatically is harder to reason about and harder to show on camera.
Explicit beats clever here.

### UI
Reverse-chronological, paginated (25). Timestamps and ids in Plex Mono. Filter by action.
The admin dashboard's attention queue reads the most recent five.

## Admin dashboard layout

Not a grid of stat cards.

```
┌───────────────────────────────────────────────────┐
│ Stats strip — one row, plain numbers              │
├────────────────────────────────┬──────────────────┤
│ Needs attention                │ Recent activity  │
│ • 1 quiz with no correct answer│ (audit log, 5)   │
│ • 3 courses with no lessons    │                  │
│ • 4 drafts over 7 days         │                  │
│ • 2 blocked users              │                  │
└────────────────────────────────┴──────────────────┘
```

Each attention row links directly to the filtered view that fixes it. An admin panel that
surfaces problems is a product; one that displays totals is a report.

**The attention queue is an integrity check on your own data model.** Each row is an
invariant the schema claims to hold but cannot enforce. The quiz row is the valuable one:
a quiz with no option marked correct produces silently wrong grading — every student
scores zero on that question, and nothing anywhere reports an error. Catching a state
that fails silently is a different quality of thinking from catching one that throws, and
it's worth one sentence on camera.

Ordered by severity, not by count: silent-wrongness first, then broken content, then
stalled pipeline, then moderation.
