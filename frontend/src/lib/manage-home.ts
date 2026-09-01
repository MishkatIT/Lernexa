import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";
import { listAllManagedCourses } from "./courses";
import { listManagedPosts } from "./blog";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type InstructorSnapshot = {
  totals: {
    courses: number;
    students: number;
    lessons: number;
    avgPercent: number;
  };
  stuckStudents: {
    name: string;
    course: string;
    courseId: string;
    enrolledAt: string;
  }[];
  strugglingCourses: {
    id: string;
    title: string;
    enrolled: number;
    avgPercent: number;
  }[];
  courses: {
    id: string;
    title: string;
    enrolled: number;
    lessons: number;
    avgPercent: number;
  }[];
};

const EMPTY_SNAPSHOT: InstructorSnapshot = {
  totals: { courses: 0, students: 0, lessons: 0, avgPercent: 0 },
  stuckStudents: [],
  strugglingCourses: [],
  courses: [],
};

/** Instructor home — "which students are stuck?". Exceptions, not totals.
 *  One request: the backend does the cross-course rollup in four flat queries
 *  (GET /api/courses/manage/snapshot) and scopes to the caller's own courses.
 *  Replaces the old 1 + N fan-out (list courses, then a student-progress call
 *  per course). */
export async function getInstructorSnapshot(): Promise<InstructorSnapshot> {
  const token = await getToken();
  if (!token) return EMPTY_SNAPSHOT;
  try {
    const res = await strapiFetch<{ data: InstructorSnapshot }>(
      "/api/courses/manage/snapshot",
      { token },
    );
    return res.data;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export type Worklist = {
  totals: {
    courses: number;
    lessons: number;
    published: number;
    drafts: number;
  };
  noLessons: { id: string; title: string }[];
  noQuiz: { id: string; title: string }[];
  staleDrafts: { id: string; title: string }[];
  recentPosts: {
    id: string;
    title: string;
    published: boolean;
    createdAt: string | null;
  }[];
};

/** Content-manager / admin home — "what content needs work?". */
export async function getWorklist(): Promise<Worklist> {
  const token = await getToken();
  const cutoff = Date.now() - WEEK_MS;

  const [courses, quizRes, posts] = await Promise.all([
    listAllManagedCourses(),
    strapiFetch<{
      data: Array<{ course?: { documentId: string } | null }>;
    }>(
      "/api/quizzes?fields[0]=title&populate[course][fields][0]=documentId&pagination[pageSize]=200",
      { token },
    ),
    listManagedPosts(),
  ]);

  const courseIdsWithQuiz = new Set(
    quizRes.data.map((q) => q.course?.documentId).filter(Boolean) as string[],
  );

  return {
    totals: {
      courses: courses.length,
      lessons: courses.reduce((s, c) => s + c.lessons.length, 0),
      published: posts.filter((p) => p.publishedAt).length,
      drafts: posts.filter((p) => !p.publishedAt).length,
    },
    noLessons: courses
      .filter((c) => c.lessons.length === 0)
      .map((c) => ({ id: c.documentId, title: c.title })),
    noQuiz: courses
      .filter((c) => !courseIdsWithQuiz.has(c.documentId))
      .map((c) => ({ id: c.documentId, title: c.title })),
    staleDrafts: posts
      .filter(
        (p) =>
          !p.publishedAt &&
          p.createdAt != null &&
          new Date(p.createdAt).getTime() < cutoff,
      )
      .map((p) => ({ id: p.documentId, title: p.title })),
    recentPosts: [...posts]
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      )
      .slice(0, 5)
      .map((p) => ({
        id: p.documentId,
        title: p.title,
        published: Boolean(p.publishedAt),
        createdAt: p.createdAt,
      })),
  };
}
