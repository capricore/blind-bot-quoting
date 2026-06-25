import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { clearStock, setStock, setStockBatch } from "@/lib/db";

/**
 * Set or clear a motor's stock. Admin only. Body:
 *   { modelId, stock }                       → set this model's stock
 *   { modelId, clear: true }                 → clear this model (back to untracked)
 *   { entries: [{ modelId, stock }] }        → batch-set/clear ("Save all"); stock null = clear
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const { modelId, stock, clear, entries } = await req.json();
    if (Array.isArray(entries)) {
      const clean: { modelId: string; stock: number | null }[] = [];
      for (const e of entries) {
        if (!e || typeof e.modelId !== "string" || !e.modelId) {
          return NextResponse.json({ error: "each entry needs a modelId" }, { status: 400 });
        }
        if (e.stock === null) {
          clean.push({ modelId: e.modelId, stock: null });
        } else if (typeof e.stock === "number" && Number.isFinite(e.stock) && e.stock >= 0) {
          clean.push({ modelId: e.modelId, stock: e.stock });
        } else {
          return NextResponse.json({ error: "stock must be a non-negative number or null" }, { status: 400 });
        }
      }
      await setStockBatch(clean);
      return NextResponse.json({ ok: true });
    }
    if (typeof modelId !== "string" || !modelId) {
      return NextResponse.json({ error: "modelId required" }, { status: 400 });
    }
    if (clear === true) {
      await clearStock(modelId);
      return NextResponse.json({ ok: true });
    }
    if (typeof stock !== "number" || !Number.isFinite(stock) || stock < 0) {
      return NextResponse.json({ error: "stock must be a non-negative number" }, { status: 400 });
    }
    await setStock(modelId, stock);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
