import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { listManagedCourses, listAllManagedCourses } from "@/lib/courses";
import { getCourseIdsWithQuiz } from "@/lib/quiz";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";

export const metadata: Metadata = { title: "Courses" };

type Filter = "needs-lessons" | "needs-quiz" | undefined;

export default async function ManageCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.filter as Filter;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() || undefined;
  const user = await getCurrentUser();
  const scopeToSelf = user?.role?.type === "instructor";

  // The backend scopes an instructor to their own courses from the token.
  // A "needs-*" filter has to look across every course, not one page.
  const [pageData, quizCourseIds] = await Promise.all([
    filter
      ? listAllManagedCourses(q).then((items) => ({
          items,
          page: 1,
          pageCount: 1,
          total: items.length,
        }))
      : listManagedCourses({ q, page }),
    getCourseIdsWithQuiz(),
  ]);

  const decorated = pageData.items.map((c) => ({
    ...c,
    noLessons: c.lessons.length === 0,
    noQuiz: !quizCourseIds.has(c.documentId),
  }));

  const visible =
    filter === "needs-lessons"
      ? decorated.filter((c) => c.noLessons)
      : filter === "needs-quiz"
        ? decorated.filter((c) => c.noQuiz)
        : decorated;

  const filterLabel =
    filter === "needs-lessons"
      ? "Courses with no lessons"
      : filter === "needs-quiz"
        ? "Courses with no quiz"
        : null;

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        as="h1"
        eyebrow="Content"
        title={scopeToSelf ? "Your courses" : "All courses"}
        description={
          filterLabel
            ? `${visible.length} ${filterLabel.toLowerCase()}.`
            : `${pageData.total} course${pageData.total === 1 ? "" : "s"}.`
        }
        action={
          <ButtonLink href="/manage/courses/new" size="sm">
            New course
          </ButtonLink>
        }
      />

      {filterLabel ? (
        <p className="mt-4 text-small">
          <Link href="/manage/courses" className="text-accent-600 hover:underline">
            ← Show all courses
          </Link>
        </p>
      ) : (
        <div className="mt-5 max-w-sm">
          <SearchField placeholder="Search your courses by title" />
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={
              filterLabel
                ? "Nothing matches this filter"
                : q
                  ? "No courses match your search"
                  : page > 1
                    ? "Nothing on this page"
                    : "No courses yet"
            }
            description={
              filterLabel
                ? "Every course in scope is in good shape."
                : q
                  ? "Try a different term, or clear the search."
                  : page > 1
                    ? "Head back to the first page."
                    : "Create your first course — you'll add lessons to it next."
            }
            action={
              filterLabel
                ? undefined
                : q
                  ? { label: "Clear search", href: "/manage/courses" }
                  : page > 1
                    ? { label: "First page", href: "/manage/courses" }
                    : { label: "New course", href: "/manage/courses/new" }
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-2">
            {visible.map((c) => (
              <li key={c.documentId}>
                <Card
                  as={Link}
                  href={`/manage/courses/${c.documentId}`}
                  interactive
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-body font-medium text-ink-900">
                      {c.title}
                    </span>
                    {!scopeToSelf && c.instructor?.fullName ? (
                      <span className="shrink-0 text-small text-ink-500">
                        {c.instructor.fullName}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {c.noLessons ? (
                      <Badge tone="warning">No lessons</Badge>
                    ) : null}
                    {!c.noLessons && c.noQuiz ? (
                      <Badge tone="neutral">No quiz</Badge>
                    ) : null}
                    <span className="font-mono text-small text-ink-500">
                      {c.lessons.length} lesson
                      {c.lessons.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
          {!filter ? (
            <Pagination
              className="mt-8"
              page={pageData.page}
              pageCount={pageData.pageCount}
              makeHref={(p) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (p > 1) params.set("page", String(p));
                const s = params.toString();
                return s ? `/manage/courses?${s}` : "/manage/courses";
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
