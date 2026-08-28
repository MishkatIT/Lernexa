import "server-only";

/**
 * The only module that talks to Strapi. `server-only` makes a client component
 * that imports it fail the build — the JWT never has a path to the browser.
 *
 * This is deliberately NOT a generic proxy. Callers pass a specific path and,
 * where needed, the caller's token. Each Server Action / route handler hits one
 * narrow Strapi endpoint (docs/ARCHITECTURE.md).
 */

const BASE = process.env.STRAPI_URL;

export class StrapiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "StrapiError";
  }
}

/** Thrown when the backend middleware reports the account is blocked. */
export class AccountBlockedError extends Error {
  constructor(readonly reason: string | null) {
    super("ACCOUNT_BLOCKED");
    this.name = "AccountBlockedError";
  }
}

type StrapiFetchOptions = Omit<RequestInit, "headers"> & {
  token?: string | null;
  headers?: Record<string, string>;
};

export async function strapiFetch<T = unknown>(
  path: string,
  { token, headers, cache, ...init }: StrapiFetchOptions = {},
): Promise<T> {
  if (!BASE) throw new Error("STRAPI_URL is not set");

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    // Default: never cache — auth exchanges and user-scoped reads. A caller
    // fetching genuinely public data (the course catalogue) may opt into
    // caching explicitly.
    cache: cache ?? "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errObj = (body as { error?: { message?: string; details?: { reason?: string } } })
      ?.error;
    const message =
      errObj?.message ??
      (body as { message?: string })?.message ??
      `Strapi responded ${res.status}`;

    if (message === "ACCOUNT_BLOCKED") {
      throw new AccountBlockedError(errObj?.details?.reason ?? null);
    }
    throw new StrapiError(message, res.status, body);
  }

  return body as T;
}
