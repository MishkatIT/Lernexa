import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { dashboardPathFor } from "@/lib/roles";

/**
 * The header's session read, moved off the server render path so the public
 * layout (and every page that doesn't otherwise need the cookie) can be static
 * / ISR. SiteHeader fetches this on the client.
 *
 * No token → `getCurrentUser()` returns null without touching Strapi, so
 * anonymous visitors get an instant `{ user: null }` and no flash.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { user: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      user: {
        name: user.fullName ?? user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role?.type ?? null,
        dashboardPath: dashboardPathFor(user.role?.type),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
