import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { loadCatalog, setModelTags, updateModel } from "@/lib/db";

/** Replace a model's full tag set, and optionally its MOQ.
 *  Body: { modelId: string, valueIds: string[], moq?: number }. Admin only. */
export async function PUT(req: Request) {
  const sb = await requireAdmin();
  if (sb instanceof NextResponse) return sb;
  try {
    const { modelId, valueIds, moq } = await req.json();
    const cat = await loadCatalog();
    if (typeof modelId !== "string" || !cat.model(modelId)) {
      return NextResponse.json({ error: "Unknown model" }, { status: 400 });
    }
    if (!Array.isArray(valueIds) || valueIds.some((v) => typeof v !== "string")) {
      return NextResponse.json({ error: "valueIds must be a string array" }, { status: 400 });
    }
    if (moq !== undefined && (typeof moq !== "number" || !Number.isFinite(moq) || moq < 0)) {
      return NextResponse.json({ error: "moq must be a non-negative number" }, { status: 400 });
    }
    await setModelTags(modelId, valueIds, sb);
    if (moq !== undefined) await updateModel(modelId, { moq }, sb);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
