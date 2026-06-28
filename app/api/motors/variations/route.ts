import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import {
  createVariationItem,
  createVariationType,
  deleteVariationItem,
  deleteVariationType,
  setModelExclusionGroups,
  setProductVariationItems,
  setRetailerProductDefaults,
  updateVariationItem,
  updateVariationType,
} from "@/lib/db";

type Entity = "type" | "item" | "assignment" | "exclusion-group" | "retailer-default";
const isEntity = (e: unknown): e is Entity =>
  e === "type" || e === "item" || e === "assignment" || e === "exclusion-group" || e === "retailer-default";

/** Coerce a `groups` payload into validated string[][] (each group a list of item ids). */
const asGroups = (v: unknown): string[][] =>
  Array.isArray(v) ? v.filter(Array.isArray).map((g) => (g as unknown[]).map(String).filter(Boolean)) : [];

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
    else if (b.entity === "exclusion-group")
      await setModelExclusionGroups(String(b.modelId ?? ""), asGroups(b.groups));
    else if (b.entity === "retailer-default")
      await setRetailerProductDefaults(
        String(b.retailerId ?? ""),
        String(b.modelId ?? ""),
        Array.isArray(b.itemIds) ? b.itemIds.map(String) : []
      );
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
