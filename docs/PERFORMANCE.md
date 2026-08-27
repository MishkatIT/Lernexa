# PERFORMANCE.md — Lernexa

Scope discipline: there are **three real N+1s** in this system. Fix those, name them in
the video, and don't gold-plate the rest. Optimising things that aren't slow is its own
kind of inexperience.

## N+1 #1 — Instructor's student-progress table (THE important one)

The naive implementation is irresistible:

```ts
// ❌ 1 + 2N queries. 30 students = 61 round trips.
const enrollments = await getEnrollments(courseId);
for (const e of enrollments) {
  progress[e.student.id] = await computeProgress(courseId, e.student.id);
}
```

The fix is **two queries, regardless of student count**:

```ts
// ✅ 2 queries total.
// 1. how many lessons in this course
const total = await strapi.db.query('api::lesson.lesson')
  .count({ where: { course: courseId } });

// 2. completion counts for every student in this course, grouped
const rows = await strapi.db.connection('lesson_completions_student_lnk')
  // …join to lesson_completions filtered by course, GROUP BY student
  ;

// merge in memory — O(n), no I/O
```

> The exact table/column names depend on Strapi 5's generated link-table schema.
> **Inspect your real schema before writing this.** Do not copy names from this document.
> If raw Knex feels risky under time pressure, an acceptable middle ground is one
> `findMany` of all completions for the course (selecting only `student.id`) and a
> `Map` reduce in JS — still 2 queries, no grouping SQL.

**Why this is the best performance demo in the project:** the naive version is what
almost everyone writes, and the difference is 61 queries vs 2. In the video, say
exactly that. Don't show the naive code — describe its cost and show the fix.

## N+1 #2 — Course list with lesson/enrollment counts

```ts
// ❌ populates every lesson of every course to call .length
courses.map(c => c.lessons.length)
```

Fix: page the courses (`limit 12`), then **one grouped count per relation** across
those 12 ids. Two extra queries, not 2N. Never populate a relation to count it.

## N+1 #3 — Admin platform stats

Eight sequential counts is eight round trips.

```ts
const [users, byRole, courses, enrollments, completions, attempts, published, drafts] =
  await Promise.all([ /* …independent count queries… */ ]);
```

Parallel, then cached (below). Users-per-role is four filtered counts or one grouped
query — four parallel counts is fine and easier to explain.

## Not an N+1, but the same discipline

- **Blog list:** select only `author.fullName`. Don't populate the full user object —
  it drags in role, timestamps, and (if you're careless) fields you'd rather not ship.
- **`getCurrentUser()`:** called by several layouts in one render. Wrap in React
  `cache()` so it hits Strapi once per request, not four times.
- **`/api/users/me`:** Strapi has historically loaded the user with all relations here.
  Request only what you need (`?populate[role][fields][0]=type`).

## Population discipline

**Never `populate=*` or `populate=deep`.** Two reasons, and the second is the one that
matters:

1. It over-fetches
2. It is how private fields leak — including `isCorrect` on quiz options

Always name fields explicitly:
```
?fields[0]=title&fields[1]=slug&populate[instructor][fields][0]=fullName
```

Explicit population is a **security** practice that happens to also be a performance
practice. Frame it that way in the video.

## The waterfall fix — `GET /api/courses/:id/learn`

The lesson viewer needs: the course, its ordered lessons, the student's completions,
and which lesson is next. Four generic REST calls is a client-side waterfall — each
round trip waits on the last.

**One purpose-specific endpoint** returns the whole learning context, already scoped to
the caller:

```json
{
  "course":   { "id": 3, "title": "…", "slug": "…" },
  "lessons":  [ { "id": 9, "title": "…", "order": 1, "completed": true }, … ],
  "progress": { "completed": 2, "total": 4, "percent": 50 },
  "nextLessonId": 11
}
```

Internally: 2 queries (lessons for the course; completions for this student+course).
This is what "narrow, purpose-specific APIs" means in practice — and it's a better
answer than REST purity, because it's a real decision with a real reason.

## Pagination — mandatory on every list

| List | Default | Max |
|---|---|---|
| Courses | 12 | 48 |
| Admin users | 20 | 100 |
| Blog posts | 10 | 50 |
| Audit log | 25 | 100 |
| Student progress | 25 | 100 |

**Clamp `pageSize` server-side.** A client asking for `pageSize=100000` must get 100,
not a table scan. This is a small performance guard that is also a small DoS guard —
worth one sentence in the video.

Note: Strapi's `/api/users` returns a plain array rather than the `{data, meta}` wrapper,
with default page size 25 and max 100. Your admin table needs its own pagination
handling for that endpoint; don't assume the standard shape.

## Caching — where it's genuinely useful, and nowhere else

Caching is not a universal answer. Three places earn it:

| Data | Strategy | Invalidation |
|---|---|---|
| Site settings / banner | `unstable_cache` tag `site-settings` | `revalidateTag('site-settings')` on admin update |
| Admin stats | tag `platform-stats`, 60s revalidate | time-based is fine; stats don't need to be instant |
| Published blog list | `revalidate: 60` | `revalidatePath('/blog')` on publish |

**Never cache:** anything user-scoped. Progress, enrollments, quiz attempts, and the
admin user list are per-request. A cached user-scoped response is a data leak waiting
for a cache-key mistake.

That last sentence is the point. Caching and authorization interact badly; the safe rule
is *cache only what is identical for everyone.*

## Performance must never bypass authorization

```ts
// ❌ fetch everything, filter in JS
const all = await getAllEnrollments();
return all.filter(e => e.course.instructor.id === user.id);
```

Wrong twice: it's a full scan, and the authorization decision now lives in application
code that a later refactor can drop. Filter at the database boundary, scoped by the
authenticated user.

## Frontend data fetching

- **Server Components by default.** `'use client'` only for real interactivity: quiz
  form, mark-complete button, role dropdown, banner dismissal.
- **Parallel, not sequential.** Independent fetches in one component go in
  `Promise.all`, not sequential `await`s. Sequential awaits are the most common
  self-inflicted waterfall.
- **Mutations are Server Actions** + `revalidatePath` / `revalidateTag`. No client
  `fetch` to Strapi — it would also mean exposing the token.
- **Streaming:** `loading.tsx` + Suspense so the shell renders while slow data (stats)
  arrives. Cheap, and visibly better.

## What NOT to optimise

Naming these shows judgment as much as the optimisations do:

- No Redis. No queue. No CDN config beyond Vercel's defaults.
- No database read replicas.
- No virtualised tables — pagination handles it at this scale.
- No memoisation of pure functions like `gradeQuiz` — it runs once per submit.
- No image optimisation pipeline — cover images are external URLs.

If asked "what would you do at 100k users?", the answer is: cache blocked-user ids,
move stats to a materialised view refreshed on a schedule, and add read replicas. Not
now.
