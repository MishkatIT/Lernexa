import type { Metadata } from "next";
import { listCatalogue } from "@/lib/courses";
import { getCurrentUser } from "@/lib/session";
import { getMyEnrollments } from "@/lib/learning";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CourseCard } from "@/components/ui/CourseCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";

export const metadata: Metadata = { title: "Courses" };

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() || undefined;

  const [{ items: courses, pageCount, total }, user, myEnrollments] =
    await Promise.all([
      listCatalogue(page, q),
      getCurrentUser(),
      getMyEnrollments(),
    ]);
  const enrollments = user?.role?.type === "student" ? myEnrollments : [];
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

      <div className="mt-6 max-w-sm">
        <SearchField placeholder="Search courses" label="Search the catalogue" />
      </div>

      {courses.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={
              q
                ? "No courses match your search"
                : page > 1
                  ? "Nothing on this page"
                  : "No courses published yet"
            }
            description={
              q
                ? "Try a different term, or clear the search."
                : page > 1
                  ? "Head back to the first page."
                  : "Courses appear here once they have at least one lesson. Check back soon."
            }
            action={
              q
                ? { label: "Clear search", href: "/courses" }
                : page > 1
                  ? { label: "First page", href: "/courses" }
                  : undefined
            }
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-small text-ink-500">
            {total} course{total === 1 ? "" : "s"}
            {q ? ` matching “${q}”` : ""}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard
                key={c.documentId}
                href={`/courses/${c.slug ?? c.documentId}`}
                title={c.title}
                instructor={c.instructor?.fullName}
                description={c.description}
                lessons={c.lessons.length}
                coverImageUrl={c.coverImageUrl}
                progress={progressByCourse.get(c.documentId) ?? null}
              />
            ))}
          </div>
          <Pagination
            className="mt-8"
            page={page}
            pageCount={pageCount}
            makeHref={(p) => {
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (p > 1) params.set("page", String(p));
              const s = params.toString();
              return s ? `/courses?${s}` : "/courses";
            }}
          />
        </>
      )}
    </Container>
  );
}
