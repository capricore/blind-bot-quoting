import { NextResponse } from "next/server";
import { ensureProfileLinked } from "@/lib/auth/profile";

/** Called by the client right after an email sign-in/sign-up to create+link the profile. */
export async function POST() {
  await ensureProfileLinked();
  return NextResponse.json({ ok: true });
}
