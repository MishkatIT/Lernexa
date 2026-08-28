import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

// POST only — a mutation, so SameSite=Lax + POST keeps it off cross-site GETs.
export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
