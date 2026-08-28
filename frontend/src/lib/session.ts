import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { strapiFetch, StrapiError, AccountBlockedError } from "./strapi";
// `cookies` is used for get/set of the session token below.

/**
 * The session cookie carries the raw Strapi JWT. httpOnly so browser JS cannot
 * read it, Secure in production, SameSite=Lax so it rides first-party
 * navigations but not cross-site POSTs (docs/ARCHITECTURE.md, D-002).
 */
const COOKIE = process.env.SESSION_COOKIE_NAME || "lms_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days — matches Strapi's default JWT lifetime

export async function setSession(jwt: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  blocked: boolean;
  role: { id: number; name: string; type: string } | null;
};

/**
 * The authenticated user, or null. Wrapped in React `cache()` so several
 * layouts in one render pass share a single call to Strapi.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await getToken();
  if (!token) return null;

  try {
    // The /users/me override returns exactly { id, username, email, fullName,
    // blocked, role: { id, name, type } } — see the backend extension.
    return await strapiFetch<CurrentUser>("/api/users/me", { token });
  } catch (err) {
    // Blocked mid-session (D-013 enforcement point 3). Cookies can't be mutated
    // during render, so we redirect with the reason as a param; the stale cookie
    // is cleared by the button on /account-blocked (a route handler).
    if (err instanceof AccountBlockedError) {
      redirect(
        `/account-blocked?reason=${encodeURIComponent(err.reason ?? "")}`,
      );
    }
    // A stale or revoked token reads as "logged out", not a crash.
    if (err instanceof StrapiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
});
