import { defineConfig } from 'vitest/config';

// Two kinds of suite live under tests/ (see docs/ARCHITECTURE.md "Testing
// strategy" and tests/README.md):
//
//   1. Pure-function unit tests — grading / progress / progression / reading.
//      No Strapi, no network.
//   2. Integration suites — permission-matrix, auth, course-lifecycle,
//      blog-lifecycle, learning, admin-platform, isolation. These hit a
//      RUNNING, SEEDED Strapi (TEST_API_URL, default http://localhost:1337).
//
// The integration suites share seeded accounts and one backend, and the write
// rate limiter (src/middlewares/rate-limit.ts) is per-IP — so files run
// sequentially, not in parallel, and timeouts are generous enough to absorb a
// 429 back-off when RATE_LIMIT_ENABLED is left on.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    // Share one module registry across files so tests/helpers/api.ts can cache
    // JWTs for the whole run (login is a rate-limited mutating request). The
    // pure-function suites are stateless, so this is safe for them too.
    isolate: false,
    testTimeout: 45_000,
    hookTimeout: 120_000,
  },
});
