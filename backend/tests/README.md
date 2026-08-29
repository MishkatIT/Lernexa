# backend/tests

Two kinds of suite, one runner (`vitest`).

## 1. Pure-function unit tests — no Strapi, no network

| File | Covers |
|---|---|
| `grading.test.ts` | `gradeQuiz`, `toStudentQuiz`, `buildAttemptReview` (D-004 / D-037) |
| `progress.test.ts` | `computeProgress`, `computeProgressForCourse`, `nextLessonId` (D-003) |
| `progression.test.ts` | `normalizeProgression`, `canCompleteLesson`, `canOpenLesson`, `lessonGates` (D-038) |
| `reading.test.ts` | `readingMinutes`, `excerpt` (blog teaser) |

These run anywhere, instantly. `npm test` always includes them.

## 2. Integration suites — hit a RUNNING, SEEDED Strapi

| File | Covers |
|---|---|
| `permission-matrix.test.ts` | the RBAC.md matrix encoded as data — every role × endpoint status code |
| `auth.test.ts` | register / login / session, `registrationEnabled` gate, blocked-token replay, `role:admin` stripping, `GET/PUT /api/users` lockdown |
| `course-lifecycle.test.ts` | create → draft/publish visibility → edit → IDOR → delete guard (course + lesson), D-034 owner scope |
| `blog-lifecycle.test.ts` | draft → not-public → publish → public → unpublish → delete; writer roles only; category validation |
| `learning.test.ts` | enroll → `/learn` → complete → derived progress → uncomplete; quiz take/submit/review (no answer key); D-038 enforcement; D-039 unpublished lesson/quiz; identity-from-token |
| `admin-platform.test.ts` | `/api/platform/*` admin-only; stats shape; users list pagination/filters; setRole / setBlock guard chain; audit log has no write endpoint |
| `isolation.test.ts` | body-level IDOR — enrollment / quiz-attempt list scoping, cross-instructor answer-key isolation, draft-course probing, owner-scoped roster + student-progress |

`tests/helpers/api.ts` is the shared client (login cache, 429-aware `api()`, `ensureStudent`,
`__audit__` fixture helpers). It is not a `*.test.ts` file, so vitest never runs it as a suite.

### How to run

```bash
cd backend
npm run seed                                   # once — seeds the six demo accounts + dataset
RATE_LIMIT_ENABLED=false npm test              # fast: ~7s, no rate-limit back-off
# or, against a deployed instance:
TEST_API_URL=https://<railway-app>.up.railway.app RATE_LIMIT_ENABLED=false npm test
```

Notes:

- **`RATE_LIMIT_ENABLED=false`** lifts *both* our write limiter (`src/middlewares/rate-limit.ts`)
  and the users-permissions auth limiter (`config/plugins.ts`), so back-to-back logins don't 429.
  The suites still pass with it left on — `api()` waits out a 429 and retries — it just takes ~2–3 min.
- The integration suites **create their own data** (`__audit__`-prefixed courses/posts,
  `*@lernexa.dev` throwaway students) and clean up in `afterAll`. They are idempotent and
  order-independent — run them twice back to back.
- `npm run seed:reset` wipes seeded + `@lernexa.dev` rows and reseeds — use it if an interrupted
  run ever strands fixtures.
- The runner uses `fileParallelism: false` + `isolate: false` so one JWT cache is shared across
  every integration file (login is rate-limited).
