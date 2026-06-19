import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "@/lib/supabase/admin";
import type { AccessoryCategory, AccessoryModel } from "@/lib/accessories-data";
import type { AccessoryBrand } from "./accessory-catalog";

// THE-772 Phase 2b — admin CRUD for the accessory catalog (brand → category → model).
// image_url is set either by direct URL or via upload (POST /api/motors/catalog/image).

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function uniqueId(table: string, base: string, sb: SupabaseClient): Promise<string> {
  let id = base || "x";
  let n = 1;
  for (;;) {
    const { data } = await sb.from(table).select("id").eq("id", id).maybeSingle();
    if (!data) return id;
    id = `${base}-${++n}`;
  }
}

// ---------------- admin read (includes inactive models, category.brandId) ----------------

export type AdminCategory = AccessoryCategory & { brandId: string };
export type AdminModel = AccessoryModel & { active: boolean };
export type AdminCatalog = { brands: AccessoryBrand[]; categories: AdminCategory[]; models: AdminModel[] };

export async function loadCatalogAdmin(sb: SupabaseClient = admin()): Promise<AdminCatalog> {
  const { data: brands } = await sb.from("accessory_brands").select("id, name, tagline").order("sort").order("name");
  const { data: cats } = await sb
    .from("accessory_categories")
    .select("id, brandId:brand_id, name, blurb, orderable, image:image_url, sort")
    .order("sort");
  const { data: mods } = await sb
    .from("accessory_models")
    .select("id, categoryId:category_id, sku, name, description, price:default_price, imageUrl:image_url, active, sort")
    .order("sort");
  return {
    brands: (brands ?? []) as unknown as AccessoryBrand[],
    categories: (cats ?? []) as unknown as AdminCategory[],
    models: ((mods ?? []) as unknown as AdminModel[]).map((m) => ({ ...m, price: m.price == null ? null : Number(m.price) })),
  };
}

// ---------------- brands ----------------

export async function createBrand(name: string, tagline: string, sb: SupabaseClient = admin()): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Brand name is required");
  const id = await uniqueId("accessory_brands", slug(n), sb);
  const { error } = await sb.from("accessory_brands").insert({ id, name: n, tagline: tagline.trim() || null });
  if (error) throw error;
}

export async function updateBrand(
  id: string,
  patch: { name?: string; tagline?: string },
  sb: SupabaseClient = admin()
): Promise<void> {
  const cols: Record<string, unknown> = {};
  if (patch.name !== undefined) cols.name = patch.name.trim();
  if (patch.tagline !== undefined) cols.tagline = patch.tagline.trim() || null;
  if (Object.keys(cols).length === 0) return;
  const { error } = await sb.from("accessory_brands").update(cols).eq("id", id);
  if (error) throw error;
}

export async function deleteBrand(id: string, sb: SupabaseClient = admin()): Promise<void> {
  const { count } = await sb.from("accessory_categories").select("id", { count: "exact", head: true }).eq("brand_id", id);
  if (count && count > 0) throw new Error("Remove this brand's categories first");
  const { error } = await sb.from("accessory_brands").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- categories ----------------

export async function createCategory(
  brandId: string,
  name: string,
  opts: { blurb?: string; orderable?: boolean; image?: string } = {},
  sb: SupabaseClient = admin()
): Promise<void> {
  const n = name.trim();
  if (!n) throw new Error("Category name is required");
  const id = await uniqueId("accessory_categories", slug(n), sb);
  const { error } = await sb.from("accessory_categories").insert({
    id, brand_id: brandId, name: n, blurb: opts.blurb?.trim() || null,
    orderable: opts.orderable ?? false, image_url: opts.image?.trim() || null,
  });
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  patch: { name?: string; blurb?: string; orderable?: boolean; image?: string; sort?: number },
  sb: SupabaseClient = admin()
): Promise<void> {
  const cols: Record<string, unknown> = {};
  if (patch.name !== undefined) cols.name = patch.name.trim();
  if (patch.blurb !== undefined) cols.blurb = patch.blurb.trim() || null;
  if (patch.orderable !== undefined) cols.orderable = patch.orderable;
  if (patch.image !== undefined) cols.image_url = patch.image.trim() || null;
  if (patch.sort !== undefined) cols.sort = patch.sort;
  if (Object.keys(cols).length === 0) return;
  const { error } = await sb.from("accessory_categories").update(cols).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string, sb: SupabaseClient = admin()): Promise<void> {
  const { count } = await sb.from("accessory_models").select("id", { count: "exact", head: true }).eq("category_id", id);
  if (count && count > 0) throw new Error("Remove this category's models first");
  const { error } = await sb.from("accessory_categories").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- models ----------------

/** Is a model referenced anywhere (quotes / inventory / pricing / tags)? Decides soft vs hard delete. */
export async function modelReferenced(id: string, sb: SupabaseClient = admin()): Promise<boolean> {
  const checks: [string, string][] = [
    ["quote_items", "product_id"],
    ["accessory_inventory", "model_id"],
    ["accessory_prices", "model_id"],
    ["accessory_model_tags", "model_id"],
  ];
  for (const [table, col] of checks) {
    const { count } = await sb.from(table).select(col, { count: "exact", head: true }).eq(col, id);
    if (count && count > 0) return true;
  }
  return false;
}

export async function createModel(
  categoryId: string,
  sku: string,
  name: string,
  opts: { description?: string; price?: number | null; image?: string } = {},
  sb: SupabaseClient = admin()
): Promise<void> {
  const s = sku.trim();
  const n = name.trim();
  if (!s || !n) throw new Error("SKU and name are required");
  const id = await uniqueId("accessory_models", slug(s), sb);
  const { error } = await sb.from("accessory_models").insert({
    id, category_id: categoryId, sku: s, name: n,
    description: opts.description?.trim() || null,
    default_price: opts.price ?? null,
    image_url: opts.image?.trim() || null,
    active: true,
  });
  if (error) throw error;
}

export async function updateModel(
  id: string,
  patch: {
    categoryId?: string; sku?: string; name?: string; description?: string;
    price?: number | null; image?: string; active?: boolean; sort?: number;
  },
  sb: SupabaseClient = admin()
): Promise<void> {
  const cols: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) cols.category_id = patch.categoryId;
  if (patch.sku !== undefined) cols.sku = patch.sku.trim();
  if (patch.name !== undefined) cols.name = patch.name.trim();
  if (patch.description !== undefined) cols.description = patch.description.trim() || null;
  if (patch.price !== undefined) cols.default_price = patch.price;
  if (patch.image !== undefined) cols.image_url = patch.image.trim() || null;
  if (patch.active !== undefined) cols.active = patch.active;
  if (patch.sort !== undefined) cols.sort = patch.sort;
  if (Object.keys(cols).length === 0) return;
  const { error } = await sb.from("accessory_models").update(cols).eq("id", id);
  if (error) throw error;
}

/** Delete a model — soft (deactivate) if it's referenced, hard otherwise. Returns what happened. */
export async function deleteModel(id: string, sb: SupabaseClient = admin()): Promise<"soft" | "hard"> {
  if (await modelReferenced(id, sb)) {
    const { error } = await sb.from("accessory_models").update({ active: false }).eq("id", id);
    if (error) throw error;
    return "soft";
  }
  const { error } = await sb.from("accessory_models").delete().eq("id", id);
  if (error) throw error;
  return "hard";
}
