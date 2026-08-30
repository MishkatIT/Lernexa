'use strict';

/**
 * Idempotent seed — `npm run seed`. Safe to run repeatedly (local or prod).
 * Everything is checked before it is created; a second run is a near-no-op.
 *
 * ----------------------------------------------------------------------------
 * WHAT IT PRODUCES
 * ----------------------------------------------------------------------------
 * The six original demo accounts are preserved exactly (README "Demo
 * credentials"), and a large, varied dataset is layered around them so the app
 * behaves like it holds real content — enough to exercise pagination, search,
 * filtering, sorting, the role dashboards, permissions and large API responses.
 *
 * Default scale (SEED_SCALE=full):
 *   ~97 users   — 2 admin, 3 content-manager, 12 instructor, ~80 student
 *                 (incl. instructors with 0 courses, students with 0/1/many
 *                 enrolments, ~7 blocked accounts with varied reasons/dates)
 *   ~59 courses — realistic titles/descriptions across many topics, spread
 *                 unevenly over the instructors; a few with 0 lessons; a few
 *                 with 0 enrolments; 3–4 "popular" courses with large rosters
 *   ~400 lessons — 0–12 per course, varied content length, some with order gaps
 *   ~16 quizzes  — 3–6 questions, 2–4 options; exactly one deliberately has a
 *                  question with no correct option (feeds the admin attention
 *                  queue — DATA_MODEL.md "Data integrity checks")
 *   ~270 enrolments, ~1400 lesson completions — every progress state:
 *                 not-started, partial, almost-done, 100% complete; recent and
 *                 old activity
 *   ~90 quiz attempts — varied scores, some retakes (2nd attempt better)
 *   ~40 blog posts — ~27 published (spread over a year), ~13 drafts incl. some
 *                 older than a week (feeds the content worklist)
 *   ~95 audit-log entries — every action type, spread over ~120 days
 *
 * Fast scale for CI / a quick check:   SEED_SCALE=min npm run seed
 *
 * ----------------------------------------------------------------------------
 * IDEMPOTENCY STRATEGY (per entity)
 * ----------------------------------------------------------------------------
 *   users              — looked up by email
 *   courses            — looked up by title
 *   lessons            — created only when the course currently has 0
 *   quizzes            — created only when the course currently has 0
 *   enrolments         — unique `dedupeKey` = "<userId>:<courseId>"
 *   lesson completions — unique `dedupeKey` = "<userId>:<lessonId>"
 *   blog posts         — looked up by title
 *   quiz attempts      — skipped when the (student, quiz) pair already has one
 *   audit-log entries  — deterministic `metadata.seedId`, checked before insert
 *
 * All "random" choices come from a seeded PRNG keyed on stable identifiers, so
 * every run produces the same dataset.
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi');

const PASSWORD = 'Lernexa123!';
const SCALE = process.env.SEED_SCALE === 'min' ? 'min' : 'full';
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(now - n * DAY);

/* ------------------------------------------------------------------------- */
/* deterministic RNG                                                         */
/* ------------------------------------------------------------------------- */

/** cyrb53 — fast, well-distributed string hash. */
function hash(str) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh PRNG seeded from `key`. Same key -> same sequence, every run. */
const rngFor = (key) => mulberry32(hash(String(key)));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (rng, p) => rng() < p;
function sample(rng, arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Run `fn` over `items` with limited concurrency (keeps the seed quick without
 *  hammering the connection pool). Order of results is not preserved. */
async function inChunks(items, fn, size = 20) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

/* ------------------------------------------------------------------------- */
/* people                                                                    */
/* ------------------------------------------------------------------------- */

// The original six. Emails, roles and the blocked account are unchanged so the
// README credentials and every existing demo still work.
const DEMO_USERS = [
  {
    email: 'admin@lernexa.test',
    fullName: 'Ada Admin',
    role: 'admin',
    bio: 'Runs the Lernexa platform. Writes about the operational side of a learning product — access control, data lifecycle, and keeping the thing online.',
  },
  {
    email: 'cm@lernexa.test',
    fullName: 'Cy Manager',
    role: 'content-manager',
    bio: 'Content manager at Lernexa. Shapes the course library and edits the blog.',
  },
  {
    email: 'instructor@lernexa.test',
    fullName: 'Ivy Instructor',
    role: 'instructor',
    bio: 'Instructor at Lernexa. Teaches the fundamentals track and writes about how people actually learn to build software.',
  },
  {
    email: 'instructor2@lernexa.test',
    fullName: 'Ike Instructor',
    role: 'instructor',
    bio: 'Instructor at Lernexa, focused on backend and API design.',
  },
  { email: 'student@lernexa.test', fullName: 'Sam Student', role: 'student' },
  {
    email: 'blocked@lernexa.test',
    fullName: 'Bo Blocked',
    role: 'student',
    blocked: true,
    blockedReason: 'Seeded as a blocked account for the demo.',
  },
];

const FIRST_NAMES = [
  'Aisha', 'Liam', 'Sofia', 'Noah', 'Mia', 'Ethan', 'Priya', 'Lucas', 'Chloe', 'Mateo',
  'Hana', 'Omar', 'Isabella', 'Kai', 'Amara', 'Leo', 'Yuki', 'Diego', 'Freya', 'Arjun',
  'Nadia', 'Ben', 'Zoe', 'Marcus', 'Layla', 'Theo', 'Ingrid', 'Sam', 'Ravi', 'Elena',
  'Jonas', 'Maya', 'Hugo', 'Talia', 'Felix', 'Naomi', 'Aaron', 'Lena', 'Iris', 'Caleb',
  'Sana', 'Tobias', 'Rosa', 'Emil', 'Nora', 'Dmitri', 'Grace', 'Idris', 'Petra', 'Owen',
];
const LAST_NAMES = [
  'Okafor', 'Nguyen', 'Rossi', 'Larsson', 'Haddad', 'Kowalski', 'Patel', 'Fernandez', 'Kim', 'Silva',
  'Andersson', 'Costa', 'Novak', 'Ivanova', 'Tanaka', 'Muller', 'Bianchi', 'Dubois', 'Schmidt', 'Reyes',
  'Ahmed', 'Johansson', 'Weber', 'Moreau', 'Kovac', 'Santos', 'Petrov', 'Hansen', 'Yilmaz', 'Marino',
  'Blomqvist', 'Cohen', 'Nakamura', 'Fischer', 'Romano', 'Sorensen', 'Volkov', 'Mensah', 'Grande', 'Bauer',
];

const BLOCK_REASONS = [
  'Repeated spam in course discussions after a warning.',
  'Shared account credentials with a third party.',
  'Automated scraping of lesson content detected.',
  'Payment charge-back fraud under review.',
  'Abusive language toward an instructor.',
  'Requested account suspension while a dispute is resolved.',
  'Multiple fake enrolments from the same address.',
];

const AVATAR = (email) => `https://i.pravatar.cc/256?u=${encodeURIComponent(email)}`;
const COVER = (slug) => `https://picsum.photos/seed/${slug}/1200/630`;

/* ------------------------------------------------------------------------- */
/* course catalogue                                                          */
/* ------------------------------------------------------------------------- */

// [title, topic, description]. `topic` drives lesson titles + the quiz bank.
// The first three are the original demo courses and must keep these titles.
const COURSE_DEFS = [
  ['React Fundamentals', 'react', 'Components, props, state and the render cycle.'],
  ['TypeScript for Teams', 'typescript', 'Types that document intent without getting in the way.'],
  ['API Design Basics', 'api', 'Designing endpoints people can use without reading the source.'],

  ['Advanced React Patterns', 'react', 'Compound components, context, refs and the patterns that keep large trees maintainable.'],
  ['React Performance in Practice', 'react', 'Profiling renders, memoization that actually helps, and when to stop.'],
  ['Server Components Explained', 'react', 'The mental model for React Server Components, streaming and the client boundary.'],
  ['Forms and Validation in React', 'react', 'Controlled inputs, schema validation and accessible error handling.'],
  ['State Management Without a Library', 'react', 'How far context, reducers and URL state get you before you reach for a store.'],

  ['Advanced TypeScript Patterns', 'typescript', 'Conditional types, mapped types, template literal types and inference tricks.'],
  ['Typing a REST Client', 'typescript', 'End-to-end types from the network boundary to the component, with no `any`.'],
  ['Generics You Will Actually Use', 'typescript', 'Practical generic functions, constraints and default type parameters.'],

  ['Modern JavaScript Deep Dive', 'javascript', 'Closures, the event loop, iterators, generators and modules from first principles.'],
  ['Asynchronous JavaScript', 'javascript', 'Promises, async/await, cancellation and error propagation done properly.'],
  ['JavaScript Testing Foundations', 'testing', 'Unit, integration and end-to-end tests, and how to decide which you need.'],
  ['Regular Expressions Deep Dive', 'javascript', 'Reading and writing regex you can maintain, with real parsing examples.'],
  ['Functional Programming in JavaScript', 'javascript', 'Purity, composition, immutability and where FP pays off in a normal codebase.'],

  ['CSS Architecture at Scale', 'css', 'Naming, layering, tokens and keeping a stylesheet honest across a large team.'],
  ['Modern CSS Layout', 'css', 'Flexbox, Grid, container queries and intrinsic sizing without hacks.'],
  ['Design Tokens and Theming', 'css', 'A single source of truth for colour, type and spacing across light and dark.'],
  ['Accessible Frontend Engineering', 'a11y', 'Semantics, focus management, ARIA and testing with a screen reader.'],
  ['Web Performance Fundamentals', 'frontend', 'Core Web Vitals, the critical path, images and a budget you can defend.'],
  ['Browser Rendering Internals', 'frontend', 'Layout, paint, composite, and why your animation janks.'],

  ['Node.js Service Fundamentals', 'node', 'HTTP, streams, the module system and structuring a service that grows.'],
  ['Building CLIs with Node', 'node', 'Argument parsing, config resolution, output that pipes, and good exit codes.'],
  ['REST API Design in Depth', 'api', 'Resources, verbs, status codes, idempotency, pagination and versioning.'],
  ['GraphQL API Design', 'graphql', 'Schema design, resolvers, the N+1 problem and pagination patterns.'],
  ['Authentication and Sessions', 'auth', 'Passwords, tokens, refresh, CSRF and the trade-offs between them.'],
  ['Authorization Patterns', 'auth', 'RBAC, ownership checks, policy layers and failing closed by default.'],
  ['API Security Essentials', 'security', 'Input validation, rate limiting, output encoding and the OWASP API top ten.'],

  ['SQL for Application Developers', 'sql', 'Joins, aggregation, subqueries and window functions with real queries.'],
  ['PostgreSQL Performance Tuning', 'database', 'EXPLAIN, indexes, statistics, connection pools and the slow-query log.'],
  ['Data Modelling Fundamentals', 'database', 'Normalisation, keys, constraints and when denormalising is the right call.'],
  ['Database Transactions and Locking', 'database', 'Isolation levels, deadlocks, optimistic vs pessimistic concurrency.'],
  ['Redis Patterns', 'database', 'Caching, rate limiting, queues, locks and the expiry pitfalls.'],

  ['Testing React Applications', 'testing', 'Testing Library, user-centric assertions, mocking the network and CI.'],
  ['Test-Driven Development in Practice', 'testing', 'Red-green-refactor on real features, and the tests worth keeping.'],
  ['End-to-End Testing with Playwright', 'testing', 'Selectors, fixtures, flakiness, parallelism and trace debugging.'],

  ['Docker for Developers', 'docker', 'Images, layers, multi-stage builds, volumes and a sane local setup.'],
  ['Kubernetes in Practice', 'kubernetes', 'Pods, deployments, services, config, probes and rolling updates.'],
  ['CI/CD Pipelines', 'devops', 'Build, test, package, deploy — fast feedback and safe rollouts.'],
  ['Infrastructure as Code', 'devops', 'Declarative infra, state, drift and reviewable change.'],
  ['Observability with OpenTelemetry', 'devops', 'Traces, metrics and logs that let you answer questions you did not pre-plan.'],
  ['Cloud Cost Awareness', 'cloud', 'Where the bill comes from and the changes that move it.'],

  ['System Design Interview Prep', 'systems', 'A repeatable approach to open-ended design questions, with worked examples.'],
  ['Designing for Scale', 'architecture', 'Load, caching, sharding, queues and the failure modes each introduces.'],
  ['Event-Driven Microservices', 'architecture', 'Events vs commands, outbox, idempotent consumers and eventual consistency.'],
  ['Clean Architecture in Practice', 'architecture', 'Boundaries, dependency direction and keeping the domain framework-free.'],
  ['Caching Strategies', 'systems', 'Cache-aside, write-through, invalidation, stampedes and staleness budgets.'],
  ['Message Queues and Streams', 'systems', 'Delivery guarantees, ordering, back-pressure and consumer groups.'],

  ['Rust Ownership and Lifetimes', 'rust', 'Move semantics, borrowing, lifetimes and reading the compiler as a teacher.'],
  ['Concurrency in Go', 'go', 'Goroutines, channels, the race detector and context cancellation.'],
  ['Python for Data Analysis', 'python', 'pandas, vectorised thinking, joins, group-by and tidy data.'],
  ['Machine Learning Foundations', 'ml', 'Features, train/test splits, overfitting, metrics and a first honest baseline.'],
  ['Practical Data Pipelines', 'data', 'Ingestion, idempotent transforms, backfills and data quality checks.'],

  ['Git Internals', 'git', 'Objects, refs, the index, rebases and recovering work you thought was lost.'],
  ['Linux Command Line Mastery', 'linux', 'Pipelines, processes, permissions, text tools and shell scripting that lasts.'],
  ['Debugging Under Pressure', 'career', 'A method for production incidents: observe, bisect, hypothesise, verify.'],
  ['Technical Writing for Engineers', 'career', 'Design docs, PR descriptions and comments future-you will thank you for.'],
  ['Working in an Agile Team', 'agile', 'Slicing work, estimates as ranges, and keeping the loop short.'],
  ['Mobile Web Fundamentals', 'mobile', 'Touch, viewport, offline, and performance on a mid-range phone.'],

  // Deliberate edge case: a very long title + a long description.
  ['A Comprehensive and Deliberately Overlong Introduction to Distributed Consensus, Replication and the Practical Consequences of the CAP Theorem for Everyday Application Engineers',
    'systems',
    'A long-form survey course. It works through why consensus is hard, what Paxos and Raft actually guarantee, how leader election and log replication behave under partition, and what all of this means when you are only trying to keep two application replicas in agreement. Expect long lessons and worked failure scenarios rather than slogans.'],
];

// Courses that intentionally get NO lessons (hidden from the public catalogue
// by rule 1, visible on the manager worklist and admin attention queue).
const EMPTY_COURSE_TITLES = new Set([
  'Cloud Cost Awareness',
  'Mobile Web Fundamentals',
  'Working in an Agile Team',
  'Debugging Under Pressure',
]);

// Course visibility demo (D-039). Everything else is `published`.
//   draft         — built out but not launched; no roster, invisible to students.
//   enrolled_only — a closed cohort still finishing; keeps its roster, gone from
//                   the catalogue, no new enrolments.
const DRAFT_COURSE_TITLES = new Set([
  'Browser Rendering Internals',
  'API Security Essentials',
]);
const ENROLLED_ONLY_COURSE_TITLES = new Set([
  'React Performance in Practice',
  'Generics You Will Actually Use',
]);
const courseStatusFor = (title) =>
  DRAFT_COURSE_TITLES.has(title)
    ? 'draft'
    : ENROLLED_ONLY_COURSE_TITLES.has(title)
      ? 'enrolled_only'
      : 'published';

// One hidden lesson in two otherwise-published courses, so the "Hidden" state is
// visible in the manage UI and drops out of student progress totals.
const isHiddenLesson = (courseTitle, idx, count) =>
  (courseTitle === 'Advanced React Patterns' && idx === count - 1) ||
  (courseTitle === 'Modern CSS Layout' && idx === 2);

// One course quiz starts hidden from students (attempts still allowed once shown).
const HIDDEN_QUIZ_COURSE_TITLES = new Set(['Git Internals']);

// Courses that get a quiz. One per topic-ish; kept to a realistic subset.
const QUIZ_COURSE_TITLES = new Set([
  'React Fundamentals',
  'Advanced React Patterns',
  'TypeScript for Teams',
  'Advanced TypeScript Patterns',
  'Modern JavaScript Deep Dive',
  'Asynchronous JavaScript',
  'Regular Expressions Deep Dive', // <- the one with a deliberately unanswerable question
  'CSS Architecture at Scale',
  'Modern CSS Layout',
  'REST API Design in Depth',
  'GraphQL API Design',
  'Authentication and Sessions',
  'SQL for Application Developers',
  'PostgreSQL Performance Tuning',
  'Testing React Applications',
  'Git Internals',
]);

/* ------------------------------------------------------------------------- */
/* lesson + content generation                                              */
/* ------------------------------------------------------------------------- */

const LESSON_TITLES = {
  react: ['Thinking in components', 'Props and composition', 'State and the render cycle', 'Effects and the dependency array', 'Lists, keys and reconciliation', 'Lifting state up', 'Context without prop drilling', 'Refs and the DOM', 'Custom hooks', 'Error boundaries', 'Suspense and data loading', 'Testing a component'],
  typescript: ['The type system mental model', 'Structural typing', 'Narrowing and control flow analysis', 'Unions, intersections and discriminated unions', 'Generics and constraints', 'Mapped and conditional types', 'Declaration files and module types', 'Typing async code', 'tsconfig that scales', 'Migrating a JS file'],
  javascript: ['Values, references and equality', 'Scope and closures', 'The event loop', 'Prototypes and classes', 'Iterators and generators', 'Modules and bundling', 'Error handling patterns', 'Immutability in practice', 'The `this` keyword', 'Memory and leaks'],
  css: ['The cascade and specificity', 'The box model, really', 'Flexbox in depth', 'Grid in depth', 'Container queries', 'Custom properties and theming', 'Logical properties', 'Stacking contexts and z-index', 'Transitions and transforms', 'Responsive typography'],
  a11y: ['Semantic HTML first', 'The accessibility tree', 'Keyboard and focus order', 'Focus management in SPAs', 'Names, roles and values', 'Live regions', 'Colour and contrast', 'Forms and error messaging', 'Testing with a screen reader', 'Common ARIA mistakes'],
  frontend: ['The critical rendering path', 'Measuring with real metrics', 'Image strategy', 'Fonts without layout shift', 'Code splitting', 'Caching on the edge', 'Hydration cost', 'A performance budget'],
  node: ['The module system', 'HTTP servers from scratch', 'Streams and back-pressure', 'Working with the file system', 'Environment and config', 'Error handling and process exit', 'Child processes', 'Packaging and publishing'],
  api: ['Resources and representations', 'Choosing status codes', 'Idempotency and safe retries', 'Pagination that scales', 'Filtering, sorting and sparse fields', 'Errors clients can act on', 'Versioning without pain', 'Documenting the contract'],
  graphql: ['Schema-first design', 'Resolvers and the execution model', 'The N+1 problem and dataloaders', 'Connections and cursor pagination', 'Mutations and input types', 'Errors and partial results', 'Caching a graph', 'Schema evolution'],
  auth: ['Passwords and hashing', 'Sessions vs tokens', 'JWTs and their sharp edges', 'Refresh and rotation', 'CSRF and SameSite', 'OAuth in one lesson', 'Multi-factor basics', 'Revocation and logout everywhere'],
  security: ['The trust boundary', 'Input validation and allowlists', 'Output encoding and injection', 'Rate limiting and abuse', 'Secrets and configuration', 'Dependency risk', 'Logging without leaking', 'A threat-model in 30 minutes'],
  sql: ['SELECT, WHERE and ORDER BY', 'Joins without fear', 'GROUP BY and aggregation', 'Subqueries and CTEs', 'Window functions', 'Indexes and the query planner', 'Transactions', 'Set operations'],
  database: ['Modelling entities and relations', 'Keys and constraints', 'Reading an EXPLAIN plan', 'Choosing an index', 'Isolation levels', 'Deadlocks and how to avoid them', 'Connection pooling', 'Migrations that do not lock'],
  testing: ['What to test and what not to', 'Arrange, act, assert', 'Test doubles and when to use them', 'Testing the network boundary', 'Deterministic time and randomness', 'Snapshot tests, carefully', 'Flakiness and how to kill it', 'Coverage as a signal, not a target'],
  docker: ['Images, layers and the cache', 'Writing a small Dockerfile', 'Multi-stage builds', 'Volumes and bind mounts', 'Networking between containers', 'Compose for local dev', 'Health checks', 'Shipping an image'],
  kubernetes: ['Pods and the scheduler', 'Deployments and ReplicaSets', 'Services and DNS', 'ConfigMaps and Secrets', 'Liveness and readiness probes', 'Rolling updates and rollbacks', 'Resource requests and limits', 'Debugging a crash loop'],
  devops: ['The pipeline as a product', 'Fast feedback first', 'Artifacts and provenance', 'Environments and promotion', 'Blue-green and canary', 'Rollback as a first-class path', 'Instrumenting the deploy', 'On-call and runbooks'],
  cloud: ['The shared responsibility model', 'Compute options compared', 'Object storage patterns', 'Managed databases', 'Where the bill comes from', 'Right-sizing and autoscaling'],
  systems: ['Framing the problem', 'Back-of-the-envelope estimates', 'Data model and access patterns', 'Caching layers', 'Partitioning and sharding', 'Queues and asynchrony', 'Failure modes and blast radius', 'Trade-offs, stated out loud'],
  architecture: ['Boundaries and dependencies', 'Commands vs events', 'The outbox pattern', 'Idempotent consumers', 'Eventual consistency in the UI', 'Keeping the domain pure', 'Testing across a boundary', 'Evolving the contract'],
  rust: ['Ownership and moves', 'Borrowing and references', 'Lifetimes, gently', 'Enums and pattern matching', 'Traits and generics', 'Error handling with Result', 'Iterators and closures', 'Reading compiler errors'],
  go: ['Goroutines and the scheduler', 'Channels and select', 'The race detector', 'Context and cancellation', 'Interfaces in Go', 'Errors as values', 'Testing and benchmarks', 'Profiling a hot path'],
  python: ['Tidy data and vectorised thinking', 'Selecting and filtering', 'Group-by and aggregation', 'Joins and reshaping', 'Missing data', 'Dates and time series', 'Plotting for understanding', 'From notebook to script'],
  ml: ['Framing a learning problem', 'Features and leakage', 'Train, validate, test', 'Bias, variance and overfitting', 'Choosing a metric', 'A first honest baseline', 'Error analysis', 'Shipping a model'],
  data: ['Sources and ingestion', 'Idempotent transforms', 'Backfills without downtime', 'Schema changes upstream', 'Data quality checks', 'Orchestration basics', 'Cost and partitioning'],
  git: ['The object model', 'Refs, branches and HEAD', 'The index and staging', 'Merge vs rebase', 'Interactive rebase', 'Reflog and recovery', 'Bisect to find a regression', 'Hooks and automation'],
  linux: ['The shell and the pipeline', 'Files, permissions and ownership', 'Processes and signals', 'Text tools: grep, sed, awk', 'Redirection and job control', 'Environment and startup files', 'Scheduling with cron', 'Writing a robust script'],
  career: ['Observe before you change', 'Bisecting a problem', 'Writing the design doc', 'The PR description', 'Comments that age well', 'Communicating status', 'Estimates as ranges'],
  agile: ['Slicing work vertically', 'Estimates as ranges', 'Keeping the loop short', 'Standups that are not status theatre', 'Retros that change something'],
  mobile: ['The viewport and units', 'Touch targets and gestures', 'Offline and the cache', 'Performance on a mid-range phone', 'Testing on real devices'],
};
const GENERIC_LESSON_TITLES = ['Getting oriented', 'Core concepts', 'A worked example', 'Common mistakes', 'Going deeper', 'Edge cases', 'Putting it together', 'Where to go next'];

const CONTENT_OPENERS = [
  'This lesson builds directly on the previous one, so make sure that idea is solid before you continue.',
  'We start with the smallest version of the problem and add realism one step at a time.',
  'The goal here is a mental model you can rely on, not a list of API calls to memorise.',
  'Read this once for the shape of it, then again with the example open in an editor.',
  'By the end you should be able to explain this to a teammate without notes.',
];
const CONTENT_BODY = {
  concept: [
    'The key distinction is between what the system guarantees and what merely happens to be true today. Guarantees survive refactors and new callers; incidental behaviour does not, and code that leans on it breaks quietly.',
    'Notice that the hard part is rarely the happy path. Most of the design effort goes into what happens when an input is missing, a call times out, or two requests race — and those cases are where bugs actually live.',
    'A useful test while you read: for each rule below, ask what would go wrong if it were relaxed. If nothing would, it is not really a rule and you can drop it.',
    'It helps to name the invariant explicitly. Once it is written down, every function either preserves it or is a place a reviewer should look hard.',
  ],
  example: [
    'Work through the example slowly. Change one thing, predict the result, then run it. The gap between your prediction and reality is exactly the part of the model that needs work.',
    'The example is deliberately small enough to hold in your head. Real code has more moving parts, but the reasoning is the same at every size.',
    'Type it out rather than copying it. The friction is the point — it forces you to decide what each line is for.',
  ],
  pitfall: [
    'The common mistake is to reach for a bigger tool before the small one has actually failed. Try the simple thing, let it break on a real case, and let that failure justify the next step.',
    'Another frequent trap is optimising a cost you have not measured. Get a number first; more often than not the bottleneck is somewhere you did not expect.',
    'Watch for solutions that only move the problem. If a change makes one call site simpler and three others stranger, it is not a simplification.',
  ],
};
const CONTENT_CLOSERS = [
  'Before moving on, mark this lesson complete only once you could rebuild the example from scratch.',
  'Exercise: take the example and break it on purpose in two different ways, then fix each.',
  'If any part felt hand-wavy, that is the thing to look up before the next lesson.',
  'Summarise the lesson in two sentences in your own words — if you cannot, re-read the middle section.',
];

function lessonTitlesFor(topic, count) {
  const bank = (LESSON_TITLES[topic] || []).concat(GENERIC_LESSON_TITLES);
  const out = [];
  for (let i = 0; i < count; i++) out.push(bank[i % bank.length]);
  return out;
}

function lessonContent(courseTitle, lessonTitle, topic, index, rng) {
  const parts = [];
  parts.push(`## ${lessonTitle}\n\n${pick(rng, CONTENT_OPENERS)} This is the ${ordinal(index + 1)} lesson of *${courseTitle}*.`);
  const paraCount = int(rng, 1, 3); // <- content-length variation
  const pools = [CONTENT_BODY.concept, CONTENT_BODY.example, CONTENT_BODY.pitfall];
  for (let i = 0; i < paraCount; i++) parts.push(pick(rng, pools[i % pools.length]));
  if (chance(rng, 0.8)) parts.push(pick(rng, CONTENT_CLOSERS));
  return parts.join('\n\n');
}

/* ------------------------------------------------------------------------- */
/* quiz bank                                                                 */
/* ------------------------------------------------------------------------- */

const QUIZ_BANK = {
  react: [
    ['What causes a component to re-render?', [['A change to its state or props', true], ['Editing an unrelated CSS file', false], ['Moving the mouse over it', false]]],
    ['Props flow…', [['from parent to child', true], ['from child to parent', false], ['in both directions equally', false]]],
    ['A good key for a list item is…', [['a stable unique id from the data', true], ['the array index, always', false], ['Math.random() per render', false]]],
    ['`useEffect` with an empty dependency array runs…', [['after the first render only', true], ['after every render', false], ['never', false]]],
    ['Lifting state up means…', [['moving shared state to the closest common ancestor', true], ['storing everything in a global', false], ['using more refs', false]]],
  ],
  typescript: [
    ['Structural typing means two types are compatible when…', [['their shapes are compatible', true], ['they share a name', false], ['they are declared in the same file', false]]],
    ['`unknown` differs from `any` because…', [['you must narrow it before use', true], ['it disables type checking', false], ['it only works with strings', false]]],
    ['A discriminated union is narrowed by…', [['checking a shared literal tag field', true], ['calling typeof on the whole object', false], ['a try/catch', false]]],
    ['`as const` on an object literal…', [['makes its properties readonly and literal-typed', true], ['casts it to `any`', false], ['deep-clones it at runtime', false]]],
  ],
  javascript: [
    ['A closure captures…', [['variables from the scope it was defined in', true], ['only global variables', false], ['nothing; it is just a function', false]]],
    ['The event loop processes microtasks…', [['before the next macrotask', true], ['once per second', false], ['only when the stack overflows', false]]],
    ['`0.1 + 0.2 === 0.3` is…', [['false, due to floating point', true], ['true', false], ['a syntax error', false]]],
    ['`Array.prototype.map` returns…', [['a new array of the same length', true], ['the same array mutated', false], ['undefined', false]]],
  ],
  css: [
    ['Specificity of `#id .class` beats…', [['`.class .class .class`', true], ['an inline style', false], ['`!important`', false]]],
    ['`flex: 1` is shorthand for…', [['flex-grow 1, flex-shrink 1, flex-basis 0%', true], ['flex-grow 1 only', false], ['flex-basis 100%', false]]],
    ['A new stacking context is created by…', [['`position` plus a `z-index`, among others', true], ['any `margin`', false], ['using `em` units', false]]],
    ['Container queries respond to…', [['the size of a containing element', true], ['the viewport only', false], ['the user agent string', false]]],
  ],
  api: [
    ['An idempotent request…', [['has the same effect whether sent once or many times', true], ['always returns 200', false], ['cannot have a body', false]]],
    ['Which status best fits "the resource state conflicts with the request"?', [['409 Conflict', true], ['400 Bad Request', false], ['500 Internal Server Error', false]]],
    ['Cursor pagination is preferred over offset when…', [['the underlying list changes while being paged', true], ['the list is tiny', false], ['you never sort', false]]],
    ['A 401 means…', [['not authenticated', true], ['authenticated but not allowed', false], ['the route does not exist', false]]],
  ],
  graphql: [
    ['The N+1 problem in resolvers is addressed with…', [['batching, e.g. a dataloader', true], ['more resolvers', false], ['disabling the cache', false]]],
    ['In GraphQL, over-fetching is reduced because…', [['the client selects exactly the fields it needs', true], ['responses are always gzipped', false], ['there is only one endpoint', false]]],
    ['A connection type typically exposes…', [['edges, nodes and pageInfo', true], ['offset and limit only', false], ['raw SQL', false]]],
  ],
  auth: [
    ['A stateless JWT is hard to revoke because…', [['nothing checks a server-side record on each request by default', true], ['it has no expiry', false], ['it is encrypted', false]]],
    ['`SameSite=Lax` cookies help mitigate…', [['CSRF on unsafe cross-site requests', true], ['XSS', false], ['SQL injection', false]]],
    ['Passwords should be stored…', [['as a slow salted hash (e.g. bcrypt/argon2)', true], ['encrypted with a shared key', false], ['in plain text behind a firewall', false]]],
  ],
  security: [
    ['Output encoding primarily prevents…', [['injection such as XSS', true], ['slow queries', false], ['memory leaks', false]]],
    ['An allowlist is safer than a denylist because…', [['it fails closed for inputs you did not anticipate', true], ['it is shorter to write', false], ['it needs no validation', false]]],
    ['Rate limiting protects against…', [['brute force and abuse', true], ['type errors', false], ['CSS specificity bugs', false]]],
  ],
  sql: [
    ['An INNER JOIN returns…', [['rows with a match in both tables', true], ['all rows from the left table', false], ['the Cartesian product, always', false]]],
    ['`GROUP BY` is required when…', [['you mix aggregates with non-aggregated columns', true], ['you use ORDER BY', false], ['the table has an index', false]]],
    ['A window function differs from GROUP BY because…', [['it keeps individual rows while adding an aggregate', true], ['it is always slower', false], ['it cannot use PARTITION BY', false]]],
    ['An index most helps…', [['selective lookups and range scans on that column', true], ['every query equally', false], ['inserts', false]]],
  ],
  database: [
    ['`EXPLAIN` shows…', [['the planner’s chosen execution plan', true], ['the query result', false], ['the table’s DDL', false]]],
    ['READ COMMITTED prevents…', [['dirty reads', true], ['all anomalies', false], ['deadlocks', false]]],
    ['A deadlock is typically resolved by…', [['one transaction being aborted and retried', true], ['restarting the database', false], ['dropping an index', false]]],
  ],
  testing: [
    ['A good unit test asserts on…', [['observable behaviour, not implementation details', true], ['private variables', false], ['the number of function calls, always', false]]],
    ['Flaky tests are often caused by…', [['real time, real network or shared state', true], ['too few assertions', false], ['using AAA structure', false]]],
    ['Coverage is best treated as…', [['a signal about untested areas', true], ['a target to hit at any cost', false], ['a performance metric', false]]],
  ],
  git: [
    ['A commit points to…', [['a tree plus its parent commit(s)', true], ['a diff only', false], ['a branch name', false]]],
    ['`git rebase` rewrites history by…', [['replaying commits onto a new base', true], ['deleting the branch', false], ['merging without a merge commit but keeping SHAs', false]]],
    ['Work "lost" after a bad reset can often be found via…', [['the reflog', true], ['git gc', false], ['nowhere; it is gone', false]]],
  ],
};
const GENERIC_QUIZ = [
  ['Which statement best matches this course’s core idea?', [['Prefer the simplest thing that works, then let real failures justify more', true], ['Always choose the most powerful tool available', false], ['Optimise before measuring', false]]],
  ['When an approach makes one call site simpler and three others stranger, it is…', [['not a simplification', true], ['still a win', false], ['required by the style guide', false]]],
  ['A stated trade-off in a design is…', [['a strength — it shows the alternatives were considered', true], ['a weakness to hide', false], ['irrelevant', false]]],
  ['The best first step when debugging is to…', [['reproduce and observe before changing anything', true], ['rewrite the module', false], ['add more logging everywhere at once', false]]],
];

function quizQuestionsFor(courseTitle, topic, rng) {
  const isBroken = courseTitle === 'Regular Expressions Deep Dive';
  const bank = (QUIZ_BANK[topic] || GENERIC_QUIZ).slice();
  // React Fundamentals keeps its documented 5-question checkpoint.
  const count =
    courseTitle === 'React Fundamentals'
      ? bank.length
      : Math.min(bank.length, int(rng, 3, Math.min(6, bank.length)));
  const chosen = bank.slice(0, count);
  return chosen.map(([prompt, opts], qi) => {
    let options = opts.map(([text, isCorrect]) => ({ text, isCorrect }));
    // The deliberate data-integrity flaw: one question with no correct option.
    if (isBroken && qi === 2) options = options.map((o) => ({ ...o, isCorrect: false }));
    // Shuffle options so the correct one is not always first.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { prompt, options };
  });
}

/* ------------------------------------------------------------------------- */
/* blog                                                                      */
/* ------------------------------------------------------------------------- */

const BLOG_TOPICS = [
  ['Welcome to Lernexa', 'Lernexa leads with where you are, not with a wall of courses. Enrol, and your dashboard resumes you at the next lesson. This first post explains the idea behind the product and what to expect as it grows.'],
  ['Why progress is derived, never stored', 'A stored completion percentage is a lie waiting to happen: it goes stale the moment a lesson is added or removed. We compute progress from completion rows on every read. Here is why that trade-off is worth it.'],
  ['How we think about pagination', 'Every list that can grow is paginated at the API, sorted deterministically, and filterable. This post walks through the choices — page size, cursor vs offset, and what the client is allowed to ask for.'],
  ['Designing the instructor dashboard', 'The instructor home answers one question: which students are stuck? It leads with exceptions, not totals. We explain the "0% after a week" heuristic and how the batched progress query keeps it fast.'],
  ['A note on account blocking', 'Blocking a user writes a row; it does not reach into their browser. We describe the per-request re-check that makes the block effective immediately, and the reason it is a middleware rather than a login-only check.'],
  ['The audit log is append-only on purpose', 'There is no edit or delete endpoint for the audit log — not even for an admin. An audit log you can edit is not an audit log. This post makes the immutability argument in full.'],
  ['Quizzes without a correct answer', 'Our admin attention queue surfaces quizzes where a question has no option marked correct. It is a silent bug: every student scores zero on that question with no error anywhere. Here is how we catch it.'],
  ['Deleting content safely', 'We do not soft-delete. Destructive operations refuse with a 409 while they would orphan data, and the UI shows the dependent count first. Two layers, on purpose.'],
  ['Server components and the client boundary', 'A populated quiz must never cross into a client component — `isCorrect` would be visible in the page source. We map to a safe shape in the server component. This post shows the pattern.'],
  ['What "done" means for a lesson', 'Marking a lesson complete requires an active enrolment, writes one idempotent row, and is undone by deleting it. No state machine, no partial credit. Simplicity as a feature.'],
  ['Reading an EXPLAIN plan', 'A short, practical guide to the parts of a Postgres query plan that matter day to day: scan types, row estimates, and the join that quietly went nested-loop.'],
  ['Indexes we added, and the ones we did not', 'Each index in the schema maps to a real query. We list them, the query each serves, and the tempting indexes we left out because the planner would ignore them.'],
  ['Idempotent seeding', 'The development seed can be run repeatedly without creating duplicates. This post covers the dedupe-key strategy and why the database unique index — not the controller check — is the real guarantee.'],
  ['Testing the network boundary', 'We test against a faked API layer, not a mocked fetch. The difference matters when the contract changes. Examples included.'],
  ['Accessible by default', 'Semantic HTML, visible focus, and a keyboard path through every flow. A checklist we actually run before merging.'],
  ['The cost of hydration', 'Shipping a component to the client is not free. We measure it, and we keep interactive islands small.'],
  ['Error states are a feature', 'Every screen has a considered empty state, loading state and error state. Users spend real time in all three.'],
  ['Rate limiting the auth endpoints', 'Brute force is cheap for an attacker and expensive for you. A short note on the limits we set and why.'],
  ['From notebook to script', 'Exploratory analysis is fine in a notebook. The moment it needs to run twice, it becomes a script with inputs and outputs.'],
  ['Estimates are ranges', 'A single-number estimate is a forecast pretending to be a fact. We estimate in ranges and revisit them.'],
  ['Caching without tears', 'Cache-aside, a short TTL, and an explicit invalidation on write. The stampede protection that stops a cold cache from taking the service down.'],
  ['Structural typing, briefly', 'Why two unrelated types can be assignable in TypeScript, and when that bites.'],
  ['The outbox pattern', 'How to publish an event and commit a database change without a distributed transaction.'],
  ['Focus management in single-page apps', 'When the route changes, where does focus go? A small thing users feel immediately.'],
  ['Writing a design doc', 'The template we use: context, goals, non-goals, options with trade-offs, decision.'],
  ['Back-pressure, explained', 'What happens when a fast producer meets a slow consumer, and the four ways to handle it.'],
  ['Draft: the roadmap', 'This post is a draft and should never be visible to a logged-out visitor. It sketches the next few phases of work.'],
  ['Draft: pricing thoughts', 'Internal draft. Rough notes on how a paid tier might be structured. Not for publication.'],
  ['Draft: community guidelines', 'Draft of the code of conduct for course discussions. Needs legal review before publishing.'],
  ['Draft: instructor onboarding', 'A checklist for new instructors: first course, first lesson, first quiz. Still missing screenshots.'],
  ['Draft: the mobile app question', 'Should there be a native app at all? Arguments both ways. Unfinished.'],
  ['Draft: deprecating the v1 API', 'Timeline and migration notes for retiring the first API version. Dates are placeholders.'],
  ['Draft: dark mode retro', 'What went well and badly in the theming work. Half-written.'],
  ['Announcing course search', 'You can now search the catalogue by title and filter by whether a course has a quiz. Small feature, frequent request.'],
  ['New: resume where you left off', 'The dashboard now surfaces your next lesson across every enrolment, ranked so in-progress courses come first.'],
  ['Performance pass: the catalogue', 'We cut the catalogue payload and moved the zero-lesson filter server-side. Numbers in the post.'],
  ['A month of uptime notes', 'What broke, what we changed, and the one alert that was noise the whole time.'],
  ['Hiring: senior frontend engineer', 'We are looking for someone who cares about the boring parts: states, accessibility, and the build staying fast.'],
  ['Open-sourcing our seed script', 'The idempotent development seed is now in the repo. Run it, read it, and tell us where it lies.'],
  ['Year one in review', 'Courses published, lessons completed, and the features that did not survive contact with users.'],
];

// Deterministic category for a post from its real title + intro. Keyword match,
// then a stable fallback — categorising real content, not inventing it.
const CATEGORY_RULES = [
  [/\bapi\b|pagination|outbox|back-?pressure|rate limit|endpoint|postgres|explain|index|sql|query plan|caching|cache/i, 'backend'],
  [/hydration|focus|single-page|client|dark mode|theming|accessible|accessibility|component/i, 'frontend'],
  [/typescript|typing|testing|seed|script|notebook|design doc|estimate/i, 'programming'],
  [/dashboard|progress|roadmap|pricing|year in review|review|announc|new:|resume|search/i, 'product'],
  [/hiring|senior|onboarding|guidelines|community|career/i, 'career'],
  [/uptime|deploy|blocking|audit|security|boundary|server component/i, 'engineering'],
];
function categoryFor(title, body) {
  const hay = `${title} ${body}`;
  for (const [re, cat] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return 'engineering';
}

/* ======================================================================== */
/* MAIN                                                                      */
/* ======================================================================== */

async function run(strapi) {
  const q = (uid) => strapi.db.query(uid);
  const knex = strapi.db.connection;
  const userService = strapi.plugin('users-permissions').service('user');
  const log = (m) => strapi.log.info(`[seed] ${m}`);
  const counts = {};

  const roles = {};
  for (const type of ['admin', 'content-manager', 'instructor', 'student']) {
    roles[type] = await q('plugin::users-permissions.role').findOne({ where: { type } });
  }

  /* ---------------------------------------------------------------------- */
  /* 1. users                                                              */
  /* ---------------------------------------------------------------------- */

  const GEN_COUNTS =
    SCALE === 'min'
      ? { admin: 1, cm: 1, instructor: 3, student: 14 }
      : { admin: 1, cm: 2, instructor: 10, student: 78 };

  const usedEmails = new Set(DEMO_USERS.map((u) => u.email));
  const genUsers = [];
  {
    let i = 0;
    const plan = [
      ...Array(GEN_COUNTS.admin).fill('admin'),
      ...Array(GEN_COUNTS.cm).fill('content-manager'),
      ...Array(GEN_COUNTS.instructor).fill('instructor'),
      ...Array(GEN_COUNTS.student).fill('student'),
    ];
    for (const role of plan) {
      const first = FIRST_NAMES[(i * 7) % FIRST_NAMES.length];
      const last = LAST_NAMES[(i * 13 + 3) % LAST_NAMES.length];
      let base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
      let email = `${base}@lernexa.dev`;
      let n = 2;
      while (usedEmails.has(email)) email = `${base}${n++}@lernexa.dev`;
      usedEmails.add(email);
      genUsers.push({ email, fullName: `${first} ${last}`, role });
      i++;
    }
  }

  // Deterministically choose which generated students are blocked.
  const blockedPickRng = rngFor('blocked-students');
  const genStudents = genUsers.filter((u) => u.role === 'student');
  const blockedSet = new Set(
    sample(blockedPickRng, genStudents.map((u) => u.email), SCALE === 'min' ? 2 : 6),
  );

  const allUserDefs = [...DEMO_USERS, ...genUsers];
  const byEmail = {};

  for (const u of allUserDefs) {
    let user = await q('plugin::users-permissions.user').findOne({ where: { email: u.email } });
    if (!user) {
      const r = rngFor('user:' + u.email);
      user = await userService.add({
        username: u.email,
        email: u.email,
        password: PASSWORD,
        confirmed: true,
        provider: 'local',
        role: roles[u.role].id,
        fullName: u.fullName,
        ...(u.bio ? { bio: u.bio } : {}),
        ...(chance(r, 0.35) ? { avatarUrl: AVATAR(u.email) } : {}),
      });
      counts.users = (counts.users || 0) + 1;
    }
    byEmail[u.email] = user;

    // Backfill the author bio on an already-seeded demo account (added later).
    if (u.bio && !user.bio) {
      await q('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { bio: u.bio },
      });
      user.bio = u.bio;
    }

    const shouldBlock = u.blocked || blockedSet.has(u.email);
    if (shouldBlock && !user.blocked) {
      const r = rngFor('block:' + u.email);
      await q('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          blocked: true,
          blockedReason: u.blockedReason || pick(r, BLOCK_REASONS),
          blockedAt: daysAgo(int(r, 2, 90)),
          blockedBy: byEmail['admin@lernexa.test']?.id,
        },
      });
      counts.blocked = (counts.blocked || 0) + 1;
    }
  }
  log(`users: ${allUserDefs.length} total (${counts.users || 0} new, ${counts.blocked || 0} newly blocked)`);

  const DEMO_EMAILS = new Set(DEMO_USERS.map((u) => u.email));
  const instructors = allUserDefs
    .filter((u) => u.role === 'instructor')
    .map((u) => byEmail[u.email]);
  // The bulk enrolment / progress / attempt generation runs over the *generated*
  // students only. The demo accounts (student@, blocked@) keep the exact,
  // documented story set up at the end of this script — nothing random on them.
  const students = allUserDefs
    .filter(
      (u) =>
        u.role === 'student' &&
        !DEMO_EMAILS.has(u.email) &&
        !(u.blocked || blockedSet.has(u.email)),
    )
    .map((u) => byEmail[u.email]);
  const managerOwners = [byEmail['cm@lernexa.test'], byEmail['admin@lernexa.test']];

  /* ---------------------------------------------------------------------- */
  /* 2. courses + lessons + quizzes                                        */
  /* ---------------------------------------------------------------------- */

  const courseDefs = SCALE === 'min' ? COURSE_DEFS.slice(0, 12) : COURSE_DEFS;
  const courseRecords = []; // { rec, def, topic, lessons: [rows], hasQuiz }

  // Owner assignment: original three keep their owners; two instructors are
  // deliberately left with zero courses; a few courses go to managers.
  const zeroCourseInstructors = new Set(
    instructors.slice(-2).map((u) => u.id), // last two instructors own nothing
  );
  const owningInstructors = instructors.filter((u) => !zeroCourseInstructors.has(u.id));

  let ci = 0;
  for (const [title, topic, description] of courseDefs) {
    const r = rngFor('course:' + title);
    let owner;
    if (title === 'React Fundamentals' || title === 'TypeScript for Teams') {
      owner = byEmail['instructor@lernexa.test'];
    } else if (title === 'API Design Basics') {
      owner = byEmail['instructor2@lernexa.test'];
    } else if (ci % 17 === 5) {
      owner = pick(r, managerOwners);
    } else {
      // Weight the first two "real" instructors heavier so someone has many.
      const pool =
        ci % 3 === 0
          ? owningInstructors.slice(0, 2)
          : owningInstructors;
      owner = pick(r, pool);
    }
    ci++;

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 90);

    // Lesson progression rule (D-038). Most courses stay on the default `free`;
    // two demo courses show the locked modes so the feature is visible in the
    // seeded app without any clicking.
    const progression =
      title === 'TypeScript for Teams'
        ? 'complete_locked'
        : title === 'API Design Basics'
          ? 'open_locked'
          : 'free';

    const status = courseStatusFor(title);

    let course = await q('api::course.course').findOne({ where: { title } });
    if (!course) {
      course = await q('api::course.course').create({
        data: {
          title,
          slug,
          description,
          coverImageUrl: chance(r, 0.6) ? COVER(slug) : null,
          instructor: owner.id,
          lessonProgression: progression,
          status,
          publishedAt: new Date(),
        },
      });
      counts.courses = (counts.courses || 0) + 1;
    } else {
      // idempotent re-run: bring an existing seeded course to the intended
      // progression mode + visibility.
      const patch = {};
      if (course.lessonProgression !== progression) patch.lessonProgression = progression;
      if (course.status !== status) patch.status = status;
      if (Object.keys(patch).length > 0) {
        course = await q('api::course.course').update({
          where: { id: course.id },
          data: patch,
        });
      }
    }

    // lessons — created only when the course currently has none
    let lessonRows = await q('api::lesson.lesson').findMany({
      where: { course: { id: course.id } },
      orderBy: { order: 'asc' },
    });
    if (lessonRows.length === 0 && !EMPTY_COURSE_TITLES.has(title)) {
      let lessonCount;
      if (title === 'React Fundamentals' || title === 'TypeScript for Teams' || title === 'API Design Basics') {
        lessonCount = 4; // preserve original demo shape
      } else if (ci % 11 === 0) {
        lessonCount = int(r, 1, 2); // a couple of very short courses
      } else if (title.startsWith('A Comprehensive and Deliberately Overlong')) {
        lessonCount = 12;
      } else {
        lessonCount = int(r, 4, 10);
      }
      const titles =
        title === 'React Fundamentals'
          ? ['Why components', 'Props and composition', 'State and events', 'Lists and keys']
          : lessonTitlesFor(topic, lessonCount);

      const withGap = ci % 13 === 4; // a few courses have order gaps (allowed)
      let order = 1;
      const toCreate = titles.map((lt, idx) => {
        const row = {
          title: lt,
          order,
          content: lessonContent(title, lt, topic, idx, r),
          videoUrl: chance(r, 0.3) ? `https://videos.lernexa.dev/${slug}/${idx + 1}.mp4` : null,
          course: course.id,
          published: !isHiddenLesson(title, idx, titles.length),
          publishedAt: new Date(),
        };
        order += withGap && chance(r, 0.5) ? 2 : 1;
        return row;
      });
      for (const data of toCreate) {
        await q('api::lesson.lesson').create({ data });
      }
      counts.lessons = (counts.lessons || 0) + toCreate.length;
      lessonRows = await q('api::lesson.lesson').findMany({
        where: { course: { id: course.id } },
        orderBy: { order: 'asc' },
      });
    }

    // quiz — created only when the course currently has none
    let hasQuiz = (await q('api::quiz.quiz').count({ where: { course: { id: course.id } } })) > 0;
    if (!hasQuiz && QUIZ_COURSE_TITLES.has(title) && lessonRows.length > 0) {
      await strapi.documents('api::quiz.quiz').create({
        data: {
          title: `${title} — checkpoint`,
          course: course.documentId,
          published: !HIDDEN_QUIZ_COURSE_TITLES.has(title),
          questions: quizQuestionsFor(title, topic, r),
        },
        status: 'published',
      });
      counts.quizzes = (counts.quizzes || 0) + 1;
      hasQuiz = true;
    }

    courseRecords.push({ rec: course, def: [title, topic, description], topic, lessons: lessonRows, hasQuiz });
  }
  log(
    `courses: ${courseDefs.length} total (${counts.courses || 0} new), ` +
      `+${counts.lessons || 0} lessons, +${counts.quizzes || 0} quizzes`,
  );

  /* ---------------------------------------------------------------------- */
  /* 3. enrolments + lesson completions                                    */
  /* ---------------------------------------------------------------------- */

  // `draft` courses stay rosterless — "built but not launched". `enrolled_only`
  // courses keep their roster (that's the whole point of the state), so they
  // stay in the enrolment pool (D-039).
  const enrollable = courseRecords.filter(
    (c) => !DRAFT_COURSE_TITLES.has(c.rec.title),
  );
  const withLessons = enrollable.filter((c) => c.lessons.length > 0);
  const emptyCourses = enrollable.filter((c) => c.lessons.length === 0);
  // "Popular" courses get big rosters (large student-progress responses).
  const popular = withLessons.slice(3, 3 + (SCALE === 'min' ? 1 : 4));

  // Pre-load existing dedupe keys so a re-run inserts nothing twice.
  const existingEnrolKeys = new Set(
    (await q('api::enrollment.enrollment').findMany({ select: ['dedupeKey'], limit: 100000 }))
      .map((e) => e.dedupeKey)
      .filter(Boolean),
  );
  const existingComplKeys = new Set(
    (await q('api::lesson-completion.lesson-completion').findMany({ select: ['dedupeKey'], limit: 500000 }))
      .map((e) => e.dedupeKey)
      .filter(Boolean),
  );

  const enrolPlans = []; // { student, course, enrolledAt, doneLessonIds:[], lastActivity }
  students.forEach((student, sIdx) => {
    const r = rngFor('enrol:' + student.email);

    // how many courses this student takes — a spread, incl. 0
    let nCourses;
    const bucket = sIdx % 9;
    if (bucket === 0) nCourses = 0;
    else if (bucket === 1 || bucket === 2) nCourses = 1;
    else if (bucket <= 5) nCourses = int(r, 2, 4);
    else if (bucket <= 7) nCourses = int(r, 3, 6);
    else nCourses = int(r, 5, 8);
    if (SCALE === 'min') nCourses = Math.min(nCourses, 3);

    // choose courses: bias toward popular ones
    const chosen = new Set();
    for (const p of popular) if (chance(r, 0.55) && chosen.size < nCourses) chosen.add(p);
    for (const c of sample(r, withLessons, withLessons.length)) {
      if (chosen.size >= nCourses) break;
      chosen.add(c);
    }

    // two specific students also enrol in an empty course (edge case)
    if ((sIdx === 4 || sIdx === 11) && emptyCourses.length > 0) {
      chosen.add(emptyCourses[sIdx % emptyCourses.length]);
    }

    for (const c of chosen) {
      const key = `${student.id}:${c.rec.id}`;
      // enrolment age: some very recent, most spread over ~6 months
      const recent = chance(r, 0.16);
      const enrolledAt = recent ? daysAgo(int(r, 0, 6)) : daysAgo(int(r, 7, 175));

      // progress profile
      const total = c.lessons.length;
      let doneCount = 0;
      if (total > 0) {
        const p = r();
        if (p < 0.15) doneCount = 0; // not started
        else if (p < 0.6) doneCount = int(r, 1, Math.max(1, total - 1)); // partial
        else if (p < 0.82) doneCount = Math.max(1, total - int(r, 1, 2)); // almost done
        else doneCount = total; // complete
      }
      const doneLessons = c.lessons.slice(0, doneCount); // contiguous, realistic

      // completion timestamps: increasing, between enrolledAt and now
      const span = Math.max(DAY, now - enrolledAt.getTime());
      let lastActivity = null;
      const completions = doneLessons.map((lesson, k) => {
        const frac = (k + 1) / (doneCount + 1);
        const jitter = (r() - 0.5) * 0.06;
        const t = new Date(enrolledAt.getTime() + Math.min(0.98, Math.max(0.02, frac + jitter)) * span);
        if (!lastActivity || t > lastActivity) lastActivity = t;
        return { lesson, completedAt: t };
      });
      // nudge ~1 in 6 partial learners to have activity in the last few days
      if (completions.length > 0 && doneCount < total && chance(r, 0.16)) {
        completions[completions.length - 1].completedAt = daysAgo(int(r, 0, 6));
        lastActivity = completions[completions.length - 1].completedAt;
      }

      enrolPlans.push({
        student,
        course: c,
        key,
        enrolledAt,
        completions,
      });
    }
  });

  // insert enrolments (single create — relations need lifecycle processing)
  const newEnrols = enrolPlans.filter((p) => !existingEnrolKeys.has(p.key));
  await inChunks(newEnrols, (p) =>
    q('api::enrollment.enrollment').create({
      data: {
        student: p.student.id,
        course: p.course.rec.id,
        enrolledAt: p.enrolledAt,
        dedupeKey: p.key,
        publishedAt: new Date(),
      },
    }),
  );
  counts.enrollments = newEnrols.length;

  // insert completions
  const complJobs = [];
  for (const p of enrolPlans) {
    for (const c of p.completions) {
      const key = `${p.student.id}:${c.lesson.id}`;
      if (existingComplKeys.has(key)) continue;
      existingComplKeys.add(key);
      complJobs.push({
        student: p.student.id,
        lesson: c.lesson.id,
        course: p.course.rec.id,
        completedAt: c.completedAt,
        dedupeKey: key,
      });
    }
  }
  await inChunks(complJobs, (job) =>
    q('api::lesson-completion.lesson-completion').create({
      data: { ...job, publishedAt: new Date() },
    }),
  );
  counts.completions = complJobs.length;
  log(
    `enrolments: +${counts.enrollments} (of ${enrolPlans.length} planned), ` +
      `completions: +${counts.completions}`,
  );

  /* ---------------------------------------------------------------------- */
  /* 4. quiz attempts                                                      */
  /* ---------------------------------------------------------------------- */

  const quizByCourseId = {};
  for (const c of courseRecords) {
    if (!c.hasQuiz) continue;
    const qz = await q('api::quiz.quiz').findOne({
      where: { course: { id: c.rec.id } },
      populate: { questions: { populate: { options: true } } },
      orderBy: { id: 'asc' },
    });
    if (qz) quizByCourseId[c.rec.id] = qz;
  }

  const existingAttemptPairs = new Set(
    (
      await q('api::quiz-attempt.quiz-attempt').findMany({
        populate: { student: { select: ['id'] }, quiz: { select: ['id'] } },
        limit: 100000,
      })
    )
      .map((a) => (a.student && a.quiz ? `${a.student.id}:${a.quiz.id}` : null))
      .filter(Boolean),
  );

  const attemptJobs = [];
  for (const p of enrolPlans) {
    const qz = quizByCourseId[p.course.rec.id];
    if (!qz || p.completions.length === 0) continue;
    const r = rngFor('attempt:' + p.student.email + ':' + qz.id);
    if (!chance(r, 0.72)) continue;
    const pair = `${p.student.id}:${qz.id}`;
    if (existingAttemptPairs.has(pair)) continue;
    existingAttemptPairs.add(pair);

    const totalQ = (qz.questions || []).length || 4;
    const buildAnswers = (targetScore) => {
      const arr = [];
      for (let i = 0; i < totalQ; i++) {
        const correct = i < targetScore;
        arr.push({
          questionId: (qz.questions && qz.questions[i] && qz.questions[i].id) || i + 1,
          selectedOptionId: chance(r, 0.9) ? int(r, 1, 4) : null,
          correct,
        });
      }
      return arr;
    };

    const base = new Date(
      Math.min(
        now - DAY,
        (p.completions[p.completions.length - 1].completedAt.getTime() || now) + int(r, 0, 5) * DAY,
      ),
    );
    const firstScore = int(r, 0, totalQ);
    attemptJobs.push({
      student: p.student.id,
      quiz: qz.id,
      score: firstScore,
      totalQuestions: totalQ,
      answers: buildAnswers(firstScore),
      submittedAt: base,
    });
    // ~30% retake, and the retake is usually better
    if (chance(r, 0.3)) {
      const retakeScore = Math.min(totalQ, firstScore + int(r, 0, totalQ - firstScore));
      attemptJobs.push({
        student: p.student.id,
        quiz: qz.id,
        score: retakeScore,
        totalQuestions: totalQ,
        answers: buildAnswers(retakeScore),
        submittedAt: new Date(Math.min(now - DAY / 2, base.getTime() + int(r, 1, 20) * DAY)),
      });
    }
  }
  await inChunks(attemptJobs, (job) =>
    q('api::quiz-attempt.quiz-attempt').create({ data: { ...job, publishedAt: new Date() } }),
  );
  counts.attempts = attemptJobs.length;
  log(`quiz attempts: +${counts.attempts}`);

  /* ---------------------------------------------------------------------- */
  /* 5. blog posts                                                         */
  /* ---------------------------------------------------------------------- */

  const blogDefs = SCALE === 'min' ? BLOG_TOPICS.slice(0, 10) : BLOG_TOPICS;
  const blogAuthors = [
    byEmail['cm@lernexa.test'],
    byEmail['admin@lernexa.test'],
    ...genUsers.filter((u) => u.role === 'content-manager').map((u) => byEmail[u.email]),
    byEmail['instructor@lernexa.test'],
    byEmail['instructor2@lernexa.test'],
  ].filter(Boolean);

  const blogTitleSet = blogDefs.map(([t]) => t);

  // Self-heal: an earlier version of this script backdated `published_at` onto
  // BOTH the draft-version row and the published-version row of a document,
  // which corrupts Strapi 5 Draft & Publish state. A healthy published document
  // has exactly one row with `published_at IS NULL` (the draft version). Repair
  // any seeded document where every row is stamped published.
  try {
    const bad = await knex('blog_posts')
      .whereIn('title', blogTitleSet)
      .whereNotNull('published_at')
      .select('id', 'document_id');
    const byDoc = {};
    for (const row of bad) (byDoc[row.document_id] ||= []).push(row.id);
    let healed = 0;
    for (const [docId, ids] of Object.entries(byDoc)) {
      const totalRows = Number(
        (await knex('blog_posts').where({ document_id: docId }).count({ n: '*' }))[0].n,
      );
      if (ids.length >= 2 && ids.length === totalRows) {
        await knex('blog_posts').where({ id: Math.min(...ids) }).update({ published_at: null });
        healed++;
      }
    }
    if (healed) log(`blog: healed ${healed} corrupted draft/published rows from a prior run`);
  } catch (e) {
    strapi.log.warn(`[seed] blog self-heal skipped: ${e.message}`);
  }

  let bi = 0;
  for (const [title, body] of blogDefs) {
    bi++;
    const r = rngFor('blog:' + title);
    const category = categoryFor(title, body);
    const existing = await q('api::blog-post.blog-post').findOne({ where: { title } });
    if (existing) {
      // Backfill category + subtitle on posts seeded before those fields existed.
      if (!existing.category || !existing.subtitle) {
        await knex('blog_posts').where({ title }).update({
          ...(existing.category ? {} : { category }),
          ...(existing.subtitle ? {} : { subtitle: body.slice(0, 200) }),
        });
        counts.blogBackfilled = (counts.blogBackfilled || 0) + 1;
      }
      continue;
    }

    const isDraft = /^Draft:/.test(title);
    const author = blogAuthors[bi % blogAuthors.length];
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const longBody =
      `${body}\n\n` +
      pick(r, CONTENT_BODY.concept) +
      `\n\n` +
      pick(r, CONTENT_BODY.example) +
      (chance(r, 0.5) ? `\n\n${pick(r, CONTENT_BODY.pitfall)}` : '');

    const createdAt = daysAgo(isDraft ? int(r, 1, 40) : int(r, 2, 360));
    const publishedAt = isDraft ? null : new Date(createdAt.getTime() + int(r, 0, 4) * DAY);

    const doc = await strapi.documents('api::blog-post.blog-post').create({
      data: {
        title,
        slug,
        body: longBody,
        subtitle: body.slice(0, 200),
        category,
        author: author.id,
        coverImageUrl: chance(r, 0.5) ? COVER(slug) : null,
      },
      status: isDraft ? 'draft' : 'published',
    });

    // Backdate timestamps so "stale drafts" and the published timeline are real.
    // `documentId` groups the draft-version row (published_at IS NULL) and, for
    // a published post, the published-version row. `created_at` moves on every
    // row; `published_at` moves ONLY on the row that already has it set, so the
    // Draft & Publish state stays intact.
    await knex('blog_posts')
      .where({ document_id: doc.documentId })
      .update({ created_at: createdAt, updated_at: publishedAt || createdAt });
    if (publishedAt) {
      await knex('blog_posts')
        .where({ document_id: doc.documentId })
        .whereNotNull('published_at')
        .update({ published_at: publishedAt });
    }

    counts.blog = (counts.blog || 0) + 1;
  }
  log(
    `blog posts: ${blogDefs.length} total (${counts.blog || 0} new` +
      `${counts.blogBackfilled ? `, ${counts.blogBackfilled} backfilled` : ''})`,
  );

  /* ---------------------------------------------------------------------- */
  /* 6. audit log                                                          */
  /* ---------------------------------------------------------------------- */

  const AUDIT = 'api::audit-log.audit-log';
  const admin = byEmail['admin@lernexa.test'];
  const adminLabel = `${admin.fullName || admin.username} <${admin.email}>`;
  const labelFor = (u) => `${u.fullName || u.username} <${u.email}>`;

  const existingSeedIds = new Set(
    (await q(AUDIT).findMany({ limit: 100000 }))
      .map((row) => row.metadata && row.metadata.seedId)
      .filter(Boolean),
  );

  const auditPlans = [];
  const addAudit = (seedId, data, ageDays) => {
    auditPlans.push({
      seedId,
      createdAt: daysAgo(ageDays),
      data: { ...data, metadata: { ...(data.metadata || {}), seedId } },
    });
  };

  // registrations (older students)
  students.slice(0, SCALE === 'min' ? 6 : 24).forEach((s, i) => {
    const r = rngFor('audit-reg:' + s.email);
    addAudit(
      `reg:${s.email}`,
      {
        action: 'user.registered',
        category: 'account',
        actorId: s.id,
        actorLabel: labelFor(s),
        actorRole: 'student',
        targetType: 'user',
        targetId: String(s.id),
        targetLabel: s.email,
        metadata: { email: s.email },
        ip: `100.64.${int(r, 0, 255)}.${int(r, 1, 254)}`,
      },
      int(r, 5, 200),
    );
  });

  // role changes
  const promoted = students.slice(-6);
  promoted.forEach((s, i) => {
    const r = rngFor('audit-role:' + s.email);
    addAudit(
      `role:${s.email}`,
      {
        action: 'user.role_changed',
        category: 'security',
        actorId: admin.id,
        actorLabel: adminLabel,
        actorRole: 'admin',
        targetType: 'user',
        targetId: String(s.id),
        targetLabel: labelFor(s),
        metadata: { from: 'student', to: i % 2 ? 'instructor' : 'content-manager' },
        ip: '203.0.113.7',
      },
      int(r, 3, 120),
    );
  });

  // blocks / unblocks
  allUserDefs
    .filter((u) => u.blocked || blockedSet.has(u.email))
    .forEach((u, i) => {
      const rec = byEmail[u.email];
      const r = rngFor('audit-block:' + u.email);
      addAudit(
        `block:${u.email}`,
        {
          action: 'user.blocked',
          category: 'security',
          actorId: admin.id,
          actorLabel: adminLabel,
          actorRole: 'admin',
          targetType: 'user',
          targetId: String(rec.id),
          targetLabel: labelFor(rec),
          metadata: { reason: 'Policy violation under review.' },
          ip: '203.0.113.7',
        },
        int(r, 2, 90),
      );
      if (i === 0) {
        addAudit(
          `unblock:${u.email}`,
          {
            action: 'user.unblocked',
            category: 'security',
            actorId: admin.id,
            actorLabel: adminLabel,
            actorRole: 'admin',
            targetType: 'user',
            targetId: String(rec.id),
            targetLabel: labelFor(rec),
            metadata: {},
            ip: '203.0.113.7',
          },
          int(r, 1, 20),
        );
      }
    });

  // settings updates
  for (let i = 0; i < 3; i++) {
    const r = rngFor('audit-settings:' + i);
    addAudit(
      `settings:${i}`,
      {
        action: 'settings.updated',
        category: 'security',
        actorId: admin.id,
        actorLabel: adminLabel,
        actorRole: 'admin',
        targetType: 'settings',
        targetId: '1',
        targetLabel: 'Site settings',
        metadata: { registrationEnabled: i % 2 === 0 },
        ip: '203.0.113.7',
      },
      int(r, 4, 150),
    );
  }

  // course.created (by owning instructor) + a couple of deletions
  courseRecords.slice(0, SCALE === 'min' ? 6 : 18).forEach((c, i) => {
    const owner = instructors.find((u) => u.id === c.rec.instructor?.id) || instructors[i % instructors.length];
    const r = rngFor('audit-course:' + c.rec.title);
    addAudit(
      `course-created:${c.rec.id}`,
      {
        action: 'course.created',
        category: 'content',
        actorId: owner ? owner.id : admin.id,
        actorLabel: owner ? labelFor(owner) : adminLabel,
        actorRole: 'instructor',
        targetType: 'course',
        targetId: c.rec.documentId,
        targetLabel: c.rec.title,
        metadata: { title: c.rec.title },
        ip: `198.51.100.${int(r, 1, 254)}`,
      },
      int(r, 6, 300),
    );
  });
  // course / lesson / quiz visibility toggles (D-039) — one audit row per
  // demo-status fixture so the log actually carries these actions.
  courseRecords.forEach((c) => {
    const status = courseStatusFor(c.rec.title);
    if (status === 'published') return;
    const owner =
      instructors.find((u) => u.id === c.rec.instructor?.id) || instructors[0];
    const r = rngFor('audit-cvis:' + c.rec.title);
    addAudit(
      `course-visibility:${c.rec.id}`,
      {
        action: 'course.unpublished',
        category: 'content',
        actorId: owner ? owner.id : admin.id,
        actorLabel: owner ? labelFor(owner) : adminLabel,
        actorRole: 'instructor',
        targetType: 'course',
        targetId: c.rec.documentId,
        targetLabel: c.rec.title,
        metadata: { title: c.rec.title, to: status },
        ip: `198.51.100.${int(r, 1, 254)}`,
      },
      int(r, 3, 90),
    );
  });

  ['Legacy: Backbone Basics', 'Deprecated: Flash for the Web'].forEach((t, i) => {
    const r = rngFor('audit-cdel:' + t);
    addAudit(
      `course-deleted:${t}`,
      {
        action: 'course.deleted',
        category: 'content',
        actorId: admin.id,
        actorLabel: adminLabel,
        actorRole: 'admin',
        targetType: 'course',
        targetId: `legacy-${i}`,
        targetLabel: t,
        metadata: { title: t },
        ip: '203.0.113.7',
      },
      int(r, 30, 240),
    );
  });

  // blog.published / unpublished / deleted
  blogDefs
    .filter(([t]) => !/^Draft:/.test(t))
    .slice(0, SCALE === 'min' ? 5 : 14)
    .forEach(([t], i) => {
      const r = rngFor('audit-bp:' + t);
      const author = blogAuthors[(i + 1) % blogAuthors.length];
      addAudit(
        `blog-published:${t}`,
        {
          action: 'blog.published',
          category: 'content',
          actorId: author.id,
          actorLabel: labelFor(author),
          actorRole: author.email.includes('instructor') ? 'instructor' : 'content-manager',
          targetType: 'blog-post',
          targetId: `post-${i}`,
          targetLabel: t,
          metadata: { title: t },
          ip: `198.51.100.${int(r, 1, 254)}`,
        },
        int(r, 2, 330),
      );
    });
  {
    const r = rngFor('audit-bunp');
    addAudit(
      `blog-unpublished:roadmap`,
      {
        action: 'blog.unpublished',
        category: 'content',
        actorId: byEmail['cm@lernexa.test'].id,
        actorLabel: labelFor(byEmail['cm@lernexa.test']),
        actorRole: 'content-manager',
        targetType: 'blog-post',
        targetId: 'post-roadmap',
        targetLabel: 'Draft: the roadmap',
        metadata: { title: 'Draft: the roadmap' },
        ip: '198.51.100.24',
      },
      int(r, 10, 60),
    );
    addAudit(
      `blog-deleted:old-changelog`,
      {
        action: 'blog.deleted',
        category: 'content',
        actorId: admin.id,
        actorLabel: adminLabel,
        actorRole: 'admin',
        targetType: 'blog-post',
        targetId: 'post-old-changelog',
        targetLabel: 'Changelog: week 1 (superseded)',
        metadata: { title: 'Changelog: week 1 (superseded)' },
        ip: '203.0.113.7',
      },
      int(r, 40, 120),
    );
  }

  // password changes
  [...students.slice(0, 4), byEmail['instructor@lernexa.test'], byEmail['cm@lernexa.test']].forEach((u, i) => {
    const r = rngFor('audit-pw:' + u.email);
    addAudit(
      `pw:${u.email}`,
      {
        action: 'account.password_changed',
        category: 'account',
        actorId: u.id,
        actorLabel: u.email,
        actorRole: null,
        targetType: 'user',
        targetId: String(u.id),
        targetLabel: u.email,
        metadata: {},
        ip: `100.64.${int(r, 0, 255)}.${int(r, 1, 254)}`,
      },
      int(r, 1, 90),
    );
  });

  const newAudit = auditPlans.filter((p) => !existingSeedIds.has(p.seedId));
  for (const p of newAudit) {
    const row = await q(AUDIT).create({ data: p.data });
    await knex('audit_logs').where({ id: row.id }).update({ created_at: p.createdAt, updated_at: p.createdAt });
  }
  counts.audit = newAudit.length;
  log(`audit log: +${counts.audit} (of ${auditPlans.length} planned)`);

  /* ---------------------------------------------------------------------- */
  /* preserve the original single-student demo story                       */
  /* ---------------------------------------------------------------------- */

  const student = byEmail['student@lernexa.test'];
  const course1 = courseRecords.find((c) => c.rec.title === 'React Fundamentals');
  if (course1) {
    const enrolKey = `${student.id}:${course1.rec.id}`;
    if (!(await q('api::enrollment.enrollment').findOne({ where: { dedupeKey: enrolKey } }))) {
      await q('api::enrollment.enrollment').create({
        data: {
          student: student.id,
          course: course1.rec.id,
          enrolledAt: daysAgo(21),
          dedupeKey: enrolKey,
          publishedAt: new Date(),
        },
      });
    }
    const firstTwo = course1.lessons.slice(0, 2);
    for (const lesson of firstTwo) {
      const key = `${student.id}:${lesson.id}`;
      if (!(await q('api::lesson-completion.lesson-completion').findOne({ where: { dedupeKey: key } }))) {
        await q('api::lesson-completion.lesson-completion').create({
          data: {
            student: student.id,
            lesson: lesson.id,
            course: course1.rec.id,
            completedAt: daysAgo(int(rngFor('demo-compl:' + lesson.id), 2, 18)),
            dedupeKey: key,
            publishedAt: new Date(),
          },
        });
      }
    }

    // one quiz attempt for student@ so the dashboard's "Recent quiz scores"
    // section renders on the demo account
    const demoQuiz = await q('api::quiz.quiz').findOne({
      where: { course: { id: course1.rec.id } },
      populate: { questions: true },
    });
    if (demoQuiz) {
      const already = await q('api::quiz-attempt.quiz-attempt').count({
        where: { student: { id: student.id }, quiz: { id: demoQuiz.id } },
      });
      if (already === 0) {
        const totalQ = (demoQuiz.questions || []).length || 5;
        await q('api::quiz-attempt.quiz-attempt').create({
          data: {
            student: student.id,
            quiz: demoQuiz.id,
            score: Math.max(1, totalQ - 1),
            totalQuestions: totalQ,
            answers: (demoQuiz.questions || []).map((qn, i) => ({
              questionId: qn.id,
              selectedOptionId: i + 1,
              correct: i < totalQ - 1,
            })),
            submittedAt: daysAgo(4),
            publishedAt: new Date(),
          },
        });
      }
    }
    log('preserved: student@ enrolled in React Fundamentals, 2/4 lessons complete, 1 quiz attempt');
  }

  /* ---------------------------------------------------------------------- */
  /* summary                                                               */
  /* ---------------------------------------------------------------------- */

  strapi.log.info('[seed] ------------------------------------------------------------');
  strapi.log.info(`[seed] scale=${SCALE}  new rows this run: ${JSON.stringify(counts)}`);
  strapi.log.info(`[seed] password for every seeded account: ${PASSWORD}`);
  strapi.log.info('[seed] ------------------------------------------------------------');

  await verify(strapi);
}

/* ======================================================================== */
/* VERIFY — sanity-check the dataset against the real query paths            */
/* ======================================================================== */

async function verify(strapi) {
  const knex = strapi.db.connection;
  const line = (m) => strapi.log.info(`[seed:verify] ${m}`);
  line('running post-seed checks…');

  const tally = {};
  for (const t of [
    'up_users',
    'courses',
    'lessons',
    'quizzes',
    'enrollments',
    'lesson_completions',
    'quiz_attempts',
    'blog_posts',
    'audit_logs',
  ]) {
    try {
      const [{ n }] = await knex(t).count({ n: '*' });
      tally[t] = Number(n);
    } catch (e) {
      tally[t] = `ERR ${e.message}`;
    }
  }
  line(`row counts: ${JSON.stringify(tally)}`);

  // 1. public catalogue: courses with >=1 lesson, as the controller filters it
  const catalogue = await strapi.service('api::course.course').find({
    filters: { lessons: { id: { $notNull: true } } },
    fields: ['title'],
    pagination: { page: 1, pageSize: 12 },
  });
  const catalogueTotal = catalogue.pagination?.total ?? catalogue.results?.length;
  line(
    `catalogue: ${catalogueTotal} visible courses, page 1 has ${catalogue.results.length}` +
      ` (pageCount ${catalogue.pagination?.pageCount}) — pagination is exercisable: ${
        catalogueTotal > 12 ? 'YES' : 'no'
      }`,
  );

  // 2. admin user list: page 1 vs page 2 must differ
  const USER = 'plugin::users-permissions.user';
  const p1 = await strapi.db.query(USER).findMany({ orderBy: { id: 'asc' }, offset: 0, limit: 20 });
  const p2 = await strapi.db.query(USER).findMany({ orderBy: { id: 'asc' }, offset: 20, limit: 20 });
  const totalUsers = await strapi.db.query(USER).count({});
  line(
    `users: total ${totalUsers}, ${Math.ceil(totalUsers / 20)} pages @20; ` +
      `page1[0]=${p1[0]?.email} page2[0]=${p2[0]?.email} — differ: ${
        p1[0]?.email !== p2[0]?.email ? 'YES' : 'NO'
      }`,
  );

  // 3. search + filter exercise
  const searchHit = await strapi.db.query(USER).count({
    where: { $or: [{ email: { $containsi: 'lernexa.dev' } }] },
  });
  const instructorCount = await strapi.db.query(USER).count({ where: { role: { type: 'instructor' } } });
  const blockedCount = await strapi.db.query(USER).count({ where: { blocked: true } });
  const emptySearch = await strapi.db.query(USER).count({ where: { email: { $containsi: 'zzz-no-such-user' } } });
  line(
    `filters: search "lernexa.dev"→${searchHit}, role=instructor→${instructorCount}, ` +
      `status=blocked→${blockedCount}, empty-search→${emptySearch}`,
  );

  // 4. a popular course's student-progress (the batched 2-query path)
  const courseRows = await strapi.db.query('api::course.course').findMany({
    populate: { enrollments: true, lessons: true },
    limit: 200,
  });
  const withCounts = courseRows
    .map((c) => ({
      title: c.title,
      enrolled: (c.enrollments || []).length,
      lessons: (c.lessons || []).length,
    }))
    .sort((a, b) => b.enrolled - a.enrolled);
  const top = withCounts[0];
  const zeroEnrol = withCounts.filter((c) => c.enrolled === 0).length;
  const zeroLesson = withCounts.filter((c) => c.lessons === 0).length;
  line(
    `courses: busiest="${top?.title}" (${top?.enrolled} enrolled, ${top?.lessons} lessons); ` +
      `${zeroEnrol} with 0 enrolments, ${zeroLesson} with 0 lessons`,
  );

  // 5. progress spread across enrolments (dashboards depend on this variety)
  const enrolls = await strapi.db.query('api::enrollment.enrollment').findMany({
    populate: { student: { select: ['id'] }, course: { select: ['id'] } },
    limit: 100000,
  });
  const lessonsByCourse = {};
  for (const l of await strapi.db.query('api::lesson.lesson').findMany({
    populate: { course: { select: ['id'] } },
    limit: 100000,
  })) {
    if (!l.course) continue;
    (lessonsByCourse[l.course.id] ||= []).push(l.id);
  }
  const complByStudentCourse = {};
  for (const c of await strapi.db.query('api::lesson-completion.lesson-completion').findMany({
    populate: { student: { select: ['id'] }, course: { select: ['id'] } },
    limit: 500000,
  })) {
    if (!c.student || !c.course) continue;
    complByStudentCourse[`${c.student.id}:${c.course.id}`] =
      (complByStudentCourse[`${c.student.id}:${c.course.id}`] || 0) + 1;
  }
  let notStarted = 0;
  let partial = 0;
  let complete = 0;
  for (const e of enrolls) {
    if (!e.student || !e.course) continue;
    const total = (lessonsByCourse[e.course.id] || []).length;
    const done = complByStudentCourse[`${e.student.id}:${e.course.id}`] || 0;
    if (total === 0 || done === 0) notStarted++;
    else if (done >= total) complete++;
    else partial++;
  }
  line(
    `progress spread: ${notStarted} not-started, ${partial} partial, ${complete} complete ` +
      `(across ${enrolls.length} enrolments)`,
  );

  // 6. students with no enrolments (empty-state coverage)
  const studentRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'student' } });
  const studentUsers = await strapi.db.query(USER).findMany({
    where: { role: { id: studentRole.id } },
    populate: { enrollments: true },
    limit: 100000,
  });
  const noEnrol = studentUsers.filter((u) => (u.enrollments || []).length === 0).length;
  const manyEnrol = studentUsers.filter((u) => (u.enrollments || []).length >= 4).length;
  line(`students: ${studentUsers.length} total, ${noEnrol} with 0 enrolments, ${manyEnrol} with 4+`);

  // 7. instructors with no courses (dashboard empty state)
  const instrRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'instructor' } });
  const instrUsers = await strapi.db.query(USER).findMany({
    where: { role: { id: instrRole.id } },
    populate: { courses: true },
    limit: 100000,
  });
  line(
    `instructors: ${instrUsers.length} total, ` +
      `${instrUsers.filter((u) => (u.courses || []).length === 0).length} with 0 courses, ` +
      `busiest owns ${Math.max(...instrUsers.map((u) => (u.courses || []).length))}`,
  );

  // 8. quizzes with a question that has no correct option (attention queue)
  const quizzes = await strapi.db.query('api::quiz.quiz').findMany({
    populate: { questions: { populate: { options: true } } },
    limit: 10000,
  });
  const broken = quizzes.filter((qz) =>
    (qz.questions || []).some((qn) => !(qn.options || []).some((o) => o.isCorrect === true)),
  );
  line(`quizzes: ${quizzes.length} total, ${broken.length} with an unanswerable question (expected: 1)`);

  // 9. blog draft/published + stale drafts — counted per DOCUMENT, the way the
  //    app sees it (a document is "published" iff any of its rows is published).
  const blogRows = await knex('blog_posts').select('document_id', 'published_at', 'created_at');
  const docs = {};
  for (const row of blogRows) {
    const d = (docs[row.document_id] ||= { published: false, createdAt: row.created_at });
    if (row.published_at) d.published = true;
    if (new Date(row.created_at) < new Date(d.createdAt)) d.createdAt = row.created_at;
  }
  const docList = Object.values(docs);
  const publishedDocs = docList.filter((d) => d.published).length;
  const draftDocs = docList.filter((d) => !d.published);
  const staleDocs = draftDocs.filter(
    (d) => new Date(d.createdAt).getTime() < Date.now() - 7 * 86400e3,
  ).length;
  const anonPosts = await strapi.documents('api::blog-post.blog-post').findMany({ status: 'published' });
  line(
    `blog: ${docList.length} posts — ${publishedDocs} published, ${draftDocs.length} draft ` +
      `(${staleDocs} stale >7d); anonymous /api/blog-posts returns ${anonPosts.length}`,
  );

  // 10. audit log pagination + spread
  const auditTotal = await strapi.db.query('api::audit-log.audit-log').count({});
  const a1 = await strapi.db
    .query('api::audit-log.audit-log')
    .findMany({ orderBy: { createdAt: 'desc' }, limit: 25 });
  const a2 = await strapi.db
    .query('api::audit-log.audit-log')
    .findMany({ orderBy: { createdAt: 'desc' }, offset: 25, limit: 25 });
  const span =
    a1.length && auditTotal
      ? Math.round(
          (new Date(a1[0].createdAt).getTime() -
            new Date((a2[a2.length - 1] || a1[a1.length - 1]).createdAt).getTime()) /
            86400e3,
        )
      : 0;
  line(
    `audit: ${auditTotal} entries, ${Math.ceil(auditTotal / 25)} pages @25; ` +
      `page1[0]!=page2[0]: ${a1[0]?.id !== a2[0]?.id ? 'YES' : 'n/a'}; newest→oldest span ~${span}d`,
  );

  line('checks complete.');
}

/* ======================================================================== */

(async () => {
  const app = await createStrapi(await compileStrapi({ ignoreDiagnostics: true })).load();
  let failed = false;
  try {
    await run(app);
  } catch (err) {
    app.log.error(err);
    failed = true;
  } finally {
    // destroy() can throw a benign "aborted" while draining the pool — ignore it.
    await app.destroy().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
})();
