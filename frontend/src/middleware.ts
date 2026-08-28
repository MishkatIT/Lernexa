import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * UX-only gate. It checks that the session cookie is *present* and redirects
 * accordingly. It cannot and does not verify the JWT — the signing secret lives
 * in Strapi. Real authorization happens in Strapi; role gating in layouts uses
 * getCurrentUser() (docs/RBAC.md "Frontend's role").
 */
const COOKIE = process.env.SESSION_COOKIE_NAME || "lms_session";

const PROTECTED = ["/dashboard", "/manage", "/admin", "/learn", "/my-courses"];
const AUTH_PAGES = ["/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(COOKIE);

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?returnTo=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)"],
};
