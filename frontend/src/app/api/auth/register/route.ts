import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/schemas";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import { setSession } from "@/lib/session";

// New accounts are always students — the backend forces the role (D-008/D-030).
// This handler just re-validates, forwards the allowed fields, and logs the
// user in.
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const { fullName, email, password } = parsed.data;

  try {
    const { jwt } = await strapiFetch<{ jwt: string }>(
      "/api/auth/local/register",
      {
        method: "POST",
        body: JSON.stringify({ email, password, fullName }),
      },
    );

    await setSession(jwt);
    return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
  } catch (err) {
    let error = "Could not create your account";
    if (err instanceof StrapiError && /taken|already/i.test(err.message)) {
      error = "That email is already registered";
    }
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
}
