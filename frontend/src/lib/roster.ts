// Neutral roster types + constants shared by the server data layer
// (`lib/courses.ts`, which is `server-only`) and the client `RosterManager`.
// Keep this module free of server-only imports so it is safe in both bundles.

export type StudentProgressRow = {
  student: { id: number; name: string };
  enrolledAt: string;
  lastActivity: string | null;
  progress: { completed: number; total: number; percent: number };
};

export type StudentProgressPage = {
  rows: StudentProgressRow[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

export const ROSTER_PAGE_SIZES = [10, 20, 50, 100] as const;
export const ROSTER_DEFAULT_PAGE_SIZE = 20;
