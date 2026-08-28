import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import { setSession } from "@/lib/session";
import { dashboardPathFor } from "@/lib/roles";

// Exchanges credentials for a Strapi JWT and stores it in the httpOnly cookie.
// The browser posts here; the token never travels back to the browser.
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  try {
    const { jwt } = await strapiFetch<{ jwt: string }>("/api/auth/local", {
      method: "POST",
      body: JSON.stringify({
        identifier: parsed.data.email,
        password: parsed.data.password,
      }),
    });

    await setSession(jwt);

    const me = await strapiFetch<{ role?: { type: string } | null }>(
      "/api/users/me",
      { token: jwt },
    );

    return NextResponse.json({
      ok: true,
      redirectTo: dashboardPathFor(me.role?.type),
    });
  } catch (err) {
    if (err instanceof StrapiError) {
      if (/blocked/i.test(err.message)) {
        return NextResponse.json(
          { ok: false, error: "This account has been blocked by an administrator." },
          { status: 403 },
        );
      }
      if (err.status < 500) {
        return NextResponse.json(
          { ok: false, error: "Wrong email or password" },
          { status: 401 },
        );
      }
    }
    return NextResponse.json({ ok: false, error: "Something went wrong" }, { status: 500 });
  }
}
