import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";
import { type RoleType } from "./roles";

/** Layout/page guard: must be logged in. Sends to /login otherwise.
 *  This is convenience + UX; the real check is Strapi rejecting the request. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Must be logged in AND hold one of the given roles. A wrong role goes to
 *  /forbidden, which names the role needed and the role held. */
export async function requireRole(...allowed: RoleType[]): Promise<CurrentUser> {
  const user = await requireUser();
  const type = user.role?.type as RoleType | undefined;
  if (!type || !allowed.includes(type)) {
    redirect(`/forbidden?need=${allowed[0]}`);
  }
  return user;
}
