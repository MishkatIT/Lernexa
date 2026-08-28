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

type StrapiFetchOptions = Omit<RequestInit, "headers"> & {
  token?: string | null;
  headers?: Record<string, string>;
};

export async function strapiFetch<T = unknown>(
  path: string,
  { token, headers, ...init }: StrapiFetchOptions = {},
): Promise<T> {
  if (!BASE) throw new Error("STRAPI_URL is not set");

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    // Never cache: every call here is either an auth exchange or user-scoped.
    // Public, cacheable reads get their own wrappers in later phases.
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string }; message?: string })?.error
        ?.message ??
      (body as { message?: string })?.message ??
      `Strapi responded ${res.status}`;
    throw new StrapiError(message, res.status, body);
  }

  return body as T;
}
