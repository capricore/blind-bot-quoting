import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import {
  createVariationItem,
  createVariationType,
  deleteVariationItem,
  deleteVariationType,
  setProductVariationItems,
  setVariationPairRestrictions,
  updateVariationItem,
  updateVariationType,
} from "@/lib/db";

type Entity = "type" | "item" | "assignment" | "restriction";
const isEntity = (e: unknown): e is Entity =>
  e === "type" || e === "item" || e === "assignment" || e === "restriction";

/** Coerce `blockedPairs` payload into validated [string, string] tuples. */
const asPairs = (v: unknown): [string, string][] =>
  Array.isArray(v)
    ? v.flatMap((p) =>
        Array.isArray(p) && p.length === 2 && p[0] && p[1] ? [[String(p[0]), String(p[1])]] as [string, string][] : []
      )
    : [];

const asPrice = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Create a variation type / item, or set a product's available items. Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const b = await req.json();
    if (!isEntity(b.entity)) return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
    if (b.entity === "type") await createVariationType(String(b.name ?? ""), b.pairGroup ?? null);
    else if (b.entity === "item") await createVariationItem(String(b.variationId ?? ""), String(b.name ?? ""), asPrice(b.price), b.image ?? null);
    else if (b.entity === "restriction")
      await setVariationPairRestrictions(String(b.variationA ?? ""), String(b.variationB ?? ""), asPairs(b.blockedPairs));
    else
      await setProductVariationItems(
        String(b.modelId ?? ""),
        Array.isArray(b.itemIds) ? b.itemIds.map(String) : [],
        Array.isArray(b.defaultItemIds) ? b.defaultItemIds.map(String) : []
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

/** Update a variation type / item. Admin only. */
export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const b = await req.json();
    if (!isEntity(b.entity) || typeof b.id !== "string") {
      return NextResponse.json({ error: "entity + id required" }, { status: 400 });
    }
    if (b.entity === "type") await updateVariationType(b.id, { name: b.name, sort: b.sort });
    else if (b.entity === "item") await updateVariationItem(b.id, { name: b.name, price: b.price === undefined ? undefined : asPrice(b.price), image: b.image });
    else return NextResponse.json({ error: "Unsupported" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

/** Delete a variation type (cascades items + assignments) or a single item. Admin only. */
export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const b = await req.json();
    if (!isEntity(b.entity) || typeof b.id !== "string") {
      return NextResponse.json({ error: "entity + id required" }, { status: 400 });
    }
    if (b.entity === "type") await deleteVariationType(b.id);
    else if (b.entity === "item") await deleteVariationItem(b.id);
    else return NextResponse.json({ error: "Unsupported" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
