import type { Metadata } from "next";
import { listCatalogue } from "@/lib/courses";
import { getCurrentUser } from "@/lib/session";
import { getMyEnrollments } from "@/lib/learning";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CourseCard } from "@/components/ui/CourseCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Courses" };

export default async function CataloguePage() {
  const [courses, user] = await Promise.all([listCatalogue(), getCurrentUser()]);
  const enrollments =
    user?.role?.type === "student" ? await getMyEnrollments() : [];
  const progressByCourse = new Map(
    enrollments.map((e) => [e.course.id, e.progress]),
  );

  return (
    <Container className="py-10 sm:py-14">
      <SectionHeader
        as="h1"
        eyebrow="Catalogue"
        title="Courses"
        description="Every course is a sequence. Enrol, and your place is kept."
      />

      {courses.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No courses published yet"
            description="Courses appear here once they have at least one lesson. Check back soon."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard
              key={c.documentId}
              href={`/courses/${c.slug ?? c.documentId}`}
              title={c.title}
              instructor={c.instructor?.fullName}
              description={c.description}
              lessons={c.lessons.length}
              progress={progressByCourse.get(c.documentId) ?? null}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
