import { NextResponse } from "next/server";
import { requireQuoteAccess } from "@/lib/auth/api";
import { deleteQuote, getQuote } from "@/lib/db";

/** Delete a draft quote (and its items). Only the owner/admin, and only while it's a draft. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteAccess(ctx);
  if (gate instanceof NextResponse) return gate;
  const { id, sb } = gate;
  try {
    const quote = await getQuote(id, sb);
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (quote.status !== "draft") {
      return NextResponse.json({ error: "Only draft quotes can be deleted" }, { status: 400 });
    }
    await deleteQuote(id, sb);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
