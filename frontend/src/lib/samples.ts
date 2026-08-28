/**
 * Presentational sample content for the logged-out homepage only. Kept in one
 * place, clearly separated from the API data layer (`lib/*` server modules) so
 * it never leaks into a real screen. Nothing here is fetched or persisted.
 */

export const SAMPLE_CONTINUE = [
  {
    topic: "Frontend Architecture",
    lesson: "Designing scalable component APIs",
    completed: 12,
    total: 16,
    lastActivity: "2 days ago",
  },
  {
    topic: "Backend Fundamentals",
    lesson: "Idempotency and safe retries",
    completed: 5,
    total: 14,
    lastActivity: "5 days ago",
  },
] as const;

export const SAMPLE_CATEGORIES = [
  { name: "Programming", blurb: "Languages, patterns, day-to-day craft.", paths: 8 },
  { name: "Computer Science", blurb: "The ideas underneath the tools.", paths: 6 },
  { name: "Systems", blurb: "How software behaves at scale.", paths: 5 },
  { name: "Data", blurb: "Modelling, querying, moving it around.", paths: 4 },
  { name: "Design", blurb: "Interfaces that get out of the way.", paths: 3 },
  { name: "Mathematics", blurb: "The parts that show up in practice.", paths: 3 },
] as const;

export const SAMPLE_STEPS = [
  {
    n: "01",
    title: "Choose what to learn",
    body: "Pick a path. Every path is a sequence, not a pile — you always know what comes next.",
  },
  {
    n: "02",
    title: "Learn at your pace",
    body: "One lesson per screen. Mark it done, move forward. No dashboards to manage.",
  },
  {
    n: "03",
    title: "Keep making progress",
    body: "Your place is remembered everywhere. Come back and pick up exactly where you left off.",
  },
] as const;

export const SAMPLE_STATS = [
  { label: "Lessons completed", value: "24" },
  { label: "Current streak", value: "7 days" },
  { label: "Learning progress", value: "68%" },
  { label: "Topics mastered", value: "12" },
] as const;
