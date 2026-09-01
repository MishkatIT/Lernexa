import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getMyEnrollments } from "@/lib/learning";
import { dashboardPathFor } from "@/lib/roles";

/**
 * The homepage's personalised slice (resume panel, continue cards, stat grid,
 * signed-out CTA), moved off the server render path so `/` prerenders as a
 * static shell and serves from the edge. The client island fetches this only
 * when the `lernexa:authed` hint says the visitor is signed in — anonymous
 * visitors never hit it and just keep the static sample content.
 *
 * No token → `getCurrentUser()` returns null without touching Strapi.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { data: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const isStudent = user.role?.type === "student";
  const enrollments = isStudent ? await getMyEnrollments() : [];

  return NextResponse.json(
    {
      data: {
        dashboardPath: dashboardPathFor(user.role?.type),
        isStudent,
        enrollments,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
