"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getToken } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import type { ActionResult } from "./courses";

const NO_SESSION = { ok: false as const, error: "Your session expired — log in again." };

export async function setUserRole(
  userId: number,
  role: string,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch(`/api/platform/users/${userId}/role`, {
      method: "PUT",
      token,
      body: JSON.stringify({ role }),
    });
    revalidatePath("/admin/users");
    revalidateTag("platform-stats", "max");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not change the role.",
    };
  }
}

export async function setUserBlock(
  userId: number,
  blocked: boolean,
  reason?: string,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch(`/api/platform/users/${userId}/block`, {
      method: "PUT",
      token,
      body: JSON.stringify({ blocked, reason }),
    });
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    revalidateTag("platform-stats", "max");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not update the account.",
    };
  }
}

export async function updateSiteSettings(input: {
  siteName: string;
  registrationEnabled: boolean;
}): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;
  try {
    await strapiFetch("/api/site-setting", {
      method: "PUT",
      token,
      body: JSON.stringify({ data: input }),
    });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof StrapiError ? err.message : "Could not save settings.",
    };
  }
}
