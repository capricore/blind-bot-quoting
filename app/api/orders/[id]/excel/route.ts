import { NextResponse } from "next/server";
import { requireOrderAccess } from "@/lib/auth/api";
import { buildOrderWorkbook } from "@/lib/excel";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOrderAccess(ctx);
  if (gate instanceof NextResponse) return gate;
  try {
    const { buffer, filename } = await buildOrderWorkbook(gate.id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    // genuine failure building the workbook — don't mask it as a 404
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
