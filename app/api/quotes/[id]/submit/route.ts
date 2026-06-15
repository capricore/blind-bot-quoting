import { NextResponse } from "next/server";
import { submitPreOrder } from "@/lib/db";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const order = await submitPreOrder(Number(id));
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
