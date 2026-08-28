import { redirect } from "next/navigation";
import { getLearnContext } from "@/lib/learning";

/** /learn/[courseId] — jump straight to the next lesson to do. */
export default async function LearnIndexPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const ctx = await getLearnContext(courseId);
  if (!ctx) redirect(`/courses/${courseId}`); // not enrolled → course detail

  const target = ctx.nextLessonId ?? ctx.lessons[0]?.id;
  if (!target) redirect("/dashboard"); // course has no lessons
  redirect(`/learn/${courseId}/${target}`);
}
