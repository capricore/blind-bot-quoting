import { NextResponse } from "next/server";
import { getCurrentUserId, userClient } from "@/lib/auth/user";
import { createQuote, sanitizeQuoteDetails } from "@/lib/db";

/** Create a new draft quote with header details. Body: QuoteDetails (all optional). */
export async function POST(req: Request) {
  const uid = await getCurrentUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const details = sanitizeQuoteDetails(await req.json().catch(() => ({})));
    const quote = await createQuote(uid, details, await userClient());
    return NextResponse.json({ quote });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
