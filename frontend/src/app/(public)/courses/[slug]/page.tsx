import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseBySlug, getCourseByDocumentId } from "@/lib/courses";
import { getCurrentUser } from "@/lib/session";
import { getLearnContext } from "@/lib/learning";
import { Container } from "@/components/ui/Container";
import { ProgressBar } from "@/components/progress/ProgressBar";
import { EnrollButton } from "@/components/EnrollButton";

type Params = { params: Promise<{ slug: string }> };

function estimate(lessons: number) {
  const mins = lessons * 8;
  return mins < 45 ? `~${Math.round(mins / 5) * 5} min` : `~${Math.round(mins / 30) / 2}h`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const course = (await getCourseBySlug(slug)) ?? (await getCourseByDocumentId(slug));
  return { title: course?.title ?? "Course" };
}

export default async function CourseDetailPage({ params }: Params) {
  const { slug } = await params;

  // Course lookup and the session read don't depend on each other — run them
  // together instead of stacking two round trips.
  const [courseBySlug, user] = await Promise.all([
    getCourseBySlug(slug),
    getCurrentUser(),
  ]);
  const course = courseBySlug ?? (await getCourseByDocumentId(slug));
  if (!course) notFound();

  const isStudent = user?.role?.type === "student";
  const learn = isStudent ? await getLearnContext(course.documentId) : null;
  const enrolled = Boolean(learn);

  const doneIds = new Set(
    learn?.lessons.filter((l) => l.completed).map((l) => l.id) ?? [],
  );
  const lockedIds = new Set(
    learn?.lessons.filter((l) => l.locked).map((l) => l.id) ?? [],
  );
  const currentId = learn?.nextLessonId ?? null;

  const lessons =
    learn?.lessons.map((l) => ({ id: l.id, title: l.title, order: l.order })) ??
    [...course.lessons]
      .sort((a, b) => a.order - b.order)
      .map((l, i) => ({ id: String(i), title: l.title, order: l.order }));

  return (
    <Container size="content" className="py-10 sm:py-14">
      <Link
        href="/courses"
        className="text-small text-ink-500 transition-colors hover:text-ink-900"
      >
        ← Courses
      </Link>

      <h1 className="mt-4 text-display text-ink-900">{course.title}</h1>
      {course.instructor?.fullName ? (
        <p className="mt-1.5 text-body text-ink-500">
          Taught by {course.instructor.fullName}
        </p>
      ) : null}
      {course.description ? (
        <p className="mt-4 max-w-[42rem] text-reading text-ink-700">
          {course.description}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-500">
        <span>{lessons.length} lessons</span>
        {lessons.length > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>{estimate(lessons.length)}</span>
          </>
        ) : null}
      </div>

      {enrolled && learn ? (
        <div className="mt-6 rounded-lg border border-ink-200 bg-paper-raised p-5">
          <div className="flex items-center justify-between">
            <p className="text-small text-ink-500">Your progress</p>
            <span className="font-mono text-small text-ink-500">
              {learn.progress.completed}/{learn.progress.total}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar
              completed={learn.progress.completed}
              total={learn.progress.total}
            />
          </div>
          <Link
            href={`/learn/${course.documentId}`}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-accent-600 px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-500"
          >
            {learn.progress.percent === 0 ? "Start learning" : "Continue"}
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          {!user ? (
            <Link
              href={`/login?returnTo=/courses/${course.slug ?? course.documentId}`}
              className="inline-flex h-10 items-center rounded-md bg-accent-600 px-4 text-body font-medium text-on-accent transition-colors hover:bg-accent-500"
            >
              Log in to enrol
            </Link>
          ) : user.role?.type !== "student" ? (
            <p className="text-small text-ink-500">Only students can enrol.</p>
          ) : lessons.length === 0 ? (
            <p className="text-small text-ink-500">
              This course has no lessons yet.
            </p>
          ) : (
            <EnrollButton courseId={course.documentId} />
          )}
        </div>
      )}

      <section className="mt-12">
        <h2 className="text-small font-medium uppercase tracking-[0.14em] text-ink-500">
          Curriculum
        </h2>
        <ol className="mt-4 divide-y divide-ink-200 overflow-hidden rounded-lg border border-ink-200">
          {lessons.map((l) => {
            const done = enrolled && doneIds.has(l.id);
            const locked = enrolled && lockedIds.has(l.id);
            const current = enrolled && !locked && l.id === currentId;
            return (
              <li
                key={`${l.order}-${l.title}`}
                className={`flex items-center gap-3 px-4 py-3 ${
                  current ? "bg-accent-100/40" : "bg-paper-raised"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                    done
                      ? "border-success bg-success text-on-accent"
                      : current
                        ? "border-accent-500 text-accent-600"
                        : "border-ink-200 text-ink-500"
                  }`}
                >
                  {done ? "✓" : locked ? "🔒" : String(l.order).padStart(2, "0")}
                </span>
                <span
                  className={`text-body ${
                    current ? "font-medium text-ink-900" : "text-ink-900"
                  }`}
                >
                  {l.title}
                </span>
                <span className="ml-auto text-small text-ink-500">
                  {done
                    ? "Done"
                    : locked
                      ? "Locked"
                      : current
                        ? "Current"
                        : enrolled
                          ? "Upcoming"
                          : "Locked"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </Container>
  );
}
