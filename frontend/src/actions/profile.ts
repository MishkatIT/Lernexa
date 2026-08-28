"use server";

import { revalidatePath } from "next/cache";
import { getToken, setSession } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import {
  profileNameSchema,
  passwordChangeSchema,
  avatarSchema,
  type ProfileNameInput,
  type PasswordChangeInput,
  type AvatarInput,
} from "@/lib/schemas";
import type { ActionResult } from "./courses";

const NO_SESSION = {
  ok: false as const,
  error: "Your session expired — log in again.",
};

/**
 * Update the caller's display name. Hits the custom `PUT /api/users/me`
 * (fullName only — role, email and blocked are not writable there).
 */
export async function updateProfileName(
  input: ProfileNameInput,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields." };
  }

  try {
    await strapiFetch("/api/users/me", {
      method: "PUT",
      token,
      body: JSON.stringify({ fullName: parsed.data.fullName }),
    });
    // Name shows in every header and the dashboard greeting.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof StrapiError ? err.message : "Could not save your name.",
    };
  }
}

/**
 * Set or clear the caller's profile photo. `avatarUrl` is a resized data URL
 * (or a link); an empty string removes it. Same `PUT /api/users/me` endpoint —
 * the backend still only lets `fullName` and `avatarUrl` through.
 */
export async function updateAvatar(input: AvatarInput): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const parsed = avatarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That image can't be used.",
    };
  }

  try {
    await strapiFetch("/api/users/me", {
      method: "PUT",
      token,
      body: JSON.stringify({ avatarUrl: parsed.data.avatarUrl }),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof StrapiError ? err.message : "Could not save your photo.",
    };
  }
}

/**
 * Change the caller's password via Strapi's built-in
 * `POST /api/auth/change-password`. It returns a fresh JWT, so we rotate the
 * session cookie — otherwise the next request would carry a token minted
 * against the old password.
 */
export async function changePassword(
  input: PasswordChangeInput,
): Promise<ActionResult> {
  const token = await getToken();
  if (!token) return NO_SESSION;

  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.",
    };
  }

  try {
    const { jwt } = await strapiFetch<{ jwt: string }>(
      "/api/auth/change-password",
      {
        method: "POST",
        token,
        body: JSON.stringify({
          currentPassword: parsed.data.currentPassword,
          password: parsed.data.password,
          passwordConfirmation: parsed.data.confirmPassword,
        }),
      },
    );
    if (jwt) await setSession(jwt);
    return { ok: true };
  } catch (err) {
    if (err instanceof StrapiError && err.status < 500) {
      // Strapi returns a 400 with "The provided current password is invalid"
      // and similar — safe and useful to surface verbatim.
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Could not change your password." };
  }
}
