import "server-only";

import { strapiFetch } from "./strapi";
import { getToken } from "./session";
import { listManagedCourses, getStudentProgress } from "./courses";
import { listManagedPosts } from "./blog";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type InstructorSnapshot = {
  stuckStudents: { name: string; course: string; courseId: string }[];
  strugglingCourses: {
    id: string;
    title: string;
    enrolled: number;
    avgPercent: number;
  }[];
  courses: { id: string; title: string; enrolled: number; lessons: number }[];
};

/** Instructor home — "which students are stuck?". Exceptions, not totals. */
export async function getInstructorSnapshot(
  userId: number,
): Promise<InstructorSnapshot> {
  const courses = await listManagedCourses(userId);
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

  for (const { course, rows } of perCourse) {
    courseList.push({
      id: course.documentId,
      title: course.title,
      enrolled: rows.length,
      lessons: course.lessons.length,
    });

    for (const r of rows) {
      if (
        r.progress.percent === 0 &&
        new Date(r.enrolledAt).getTime() < cutoff
      ) {
        stuckStudents.push({
          name: r.student.name,
          course: course.title,
          courseId: course.documentId,
        });
      }
    }

    if (rows.length > 0) {
      const avg = Math.round(
        rows.reduce((s, r) => s + r.progress.percent, 0) / rows.length,
      );
      if (avg < 30) {
        strugglingCourses.push({
          id: course.documentId,
          title: course.title,
          enrolled: rows.length,
          avgPercent: avg,
        });
      }
    }
  }

  return { stuckStudents, strugglingCourses, courses: courseList };
}

export type Worklist = {
  noLessons: { id: string; title: string }[];
  noQuiz: { id: string; title: string }[];
  staleDrafts: { id: string; title: string }[];
};

/** Content-manager / admin home — "what content needs work?". */
export async function getWorklist(): Promise<Worklist> {
  const token = await getToken();
  const cutoff = Date.now() - WEEK_MS;

  const [courses, quizRes, posts] = await Promise.all([
    listManagedCourses(),
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
  };
}
