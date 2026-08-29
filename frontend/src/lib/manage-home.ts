import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";
import { listAllManagedCourses, getStudentProgress } from "./courses";
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

/** Instructor home — "which students are stuck?". Exceptions, not totals.
 *  The backend scopes the course list to the caller (instructor) from the token. */
export async function getInstructorSnapshot(): Promise<InstructorSnapshot> {
  const courses = await listAllManagedCourses();
  const cutoff = Date.now() - WEEK_MS;

  const perCourse = await Promise.all(
    courses.map(async (c) => ({
      course: c,
      rows: await getStudentProgress(c.documentId),
    })),
  );

  const stuckStudents: InstructorSnapshot["stuckStudents"] = [];
  const strugglingCourses: InstructorSnapshot["strugglingCourses"] = [];
  const courseList: InstructorSnapshot["courses"] = [];
  const studentIds = new Set<number>();
  let percentSum = 0;
  let rowCount = 0;

  for (const { course, rows } of perCourse) {
    const avg =
      rows.length > 0
        ? Math.round(
            rows.reduce((s, r) => s + r.progress.percent, 0) / rows.length,
          )
        : 0;

    courseList.push({
      id: course.documentId,
      title: course.title,
      enrolled: rows.length,
      lessons: course.lessons.length,
      avgPercent: avg,
    });

    for (const r of rows) {
      studentIds.add(r.student.id);
      percentSum += r.progress.percent;
      rowCount += 1;
      if (
        r.progress.percent === 0 &&
        new Date(r.enrolledAt).getTime() < cutoff
      ) {
        stuckStudents.push({
          name: r.student.name,
          course: course.title,
          courseId: course.documentId,
          enrolledAt: r.enrolledAt,
        });
      }
    }

    if (rows.length > 0 && avg < 30) {
      strugglingCourses.push({
        id: course.documentId,
        title: course.title,
        enrolled: rows.length,
        avgPercent: avg,
      });
    }
  }

  return {
    totals: {
      courses: courses.length,
      students: studentIds.size,
      lessons: courseList.reduce((s, c) => s + c.lessons, 0),
      avgPercent: rowCount > 0 ? Math.round(percentSum / rowCount) : 0,
    },
    stuckStudents,
    strugglingCourses,
    courses: courseList,
  };
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
