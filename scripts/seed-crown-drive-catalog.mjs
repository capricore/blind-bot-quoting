// One-time: push Rob's existing Crown & Drive VARIATIONS into the CATALOG, and link them so the
// catalog becomes the source of truth (edit catalog → "Sync to variation" updates in place).
//
// For each of the `crown` / `drive` variation types this:
//   1. creates an orderable A-OK catalog category (Crown / Drive),
//   2. creates one catalog model per variation item (name + price + image copied),
//   3. links them: variation_types.source_category_id = new category,
//      variation_items.source_model_id = its new model.
//
// Idempotent: a type that already has source_category_id is skipped (already migrated).
// Item ids are NEVER changed, so the existing variation_product_items assignments stay valid.
//
//   node scripts/seed-crown-drive-catalog.mjs          # dry run — print the plan
//   node scripts/seed-crown-drive-catalog.mjs --fix    # apply
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const FIX = process.argv.includes("--fix");

const BRAND_ID = "a-ok";
const TARGETS = [
  { typeId: "crown", categoryName: "Crown" },
  { typeId: "drive", categoryName: "Drive" },
];

const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Pull the A-OK part number out of an item name (e.g. "1.0403.0007" / "1-0134-0017"); fall back to slug.
function deriveSku(name) {
  const matches = name.match(/\d[.\-]\d{3,4}[.\-]\d{3,4}/g);
  if (matches && matches.length) return matches[matches.length - 1].replace(/\./g, "-");
  return slug(name).slice(0, 32) || "part";
}

const rand = () => Math.random().toString(36).slice(2, 7);
async function uniqueId(table, base) {
  let id = base || "x";
  let n = 1;
  for (;;) {
    const { data } = await sb.from(table).select("id").eq("id", id).maybeSingle();
    if (!data) return id;
    id = `${base}-${++n}`;
  }
}

async function main() {
  // sanity: brand exists
  const { data: brand } = await sb.from("accessory_brands").select("id").eq("id", BRAND_ID).maybeSingle();
  if (!brand) throw new Error(`Brand ${BRAND_ID} not found`);

  for (const { typeId, categoryName } of TARGETS) {
    const { data: type } = await sb
      .from("variation_types")
      .select("id, name, source_category_id")
      .eq("id", typeId)
      .maybeSingle();
    if (!type) {
      console.log(`\n⚠ variation type "${typeId}" not found — skipping`);
      continue;
    }
    if (type.source_category_id) {
      console.log(`\n✓ "${type.name}" already linked to category ${type.source_category_id} — skipping`);
      continue;
    }

    const { data: items } = await sb
      .from("variation_items")
      .select("id, name, price, image_url, sort")
      .eq("variation_id", typeId)
      .order("sort")
      .order("name");

    console.log(`\n=== ${categoryName} (variation "${typeId}", ${(items ?? []).length} items) ===`);
    const catId = FIX ? await uniqueId("accessory_categories", slug(categoryName)) : `(slug ${slug(categoryName)})`;
    console.log(` category → ${catId}  brand=${BRAND_ID} orderable=true`);

    if (FIX) {
      const { error: cErr } = await sb.from("accessory_categories").insert({
        id: catId, brand_id: BRAND_ID, name: categoryName, blurb: null, orderable: true, image_url: null,
      });
      if (cErr) throw cErr;
    }

    let idx = 0;
    for (const it of items ?? []) {
      const sku = deriveSku(it.name);
      const modelId = FIX ? await uniqueId("accessory_models", `${slug(sku)}-${rand()}`) : `(${slug(sku)}-…)`;
      console.log(`   model ${modelId}  sku="${sku}"  $${it.price}  img=${it.image_url ? "Y" : "-"}  ${it.name}`);
      if (FIX) {
        const { error: mErr } = await sb.from("accessory_models").insert({
          id: modelId, category_id: catId, sku, name: it.name,
          description: null, default_price: it.price, image_url: it.image_url, active: true, sort: idx,
        });
        if (mErr) throw mErr;
        const { error: lErr } = await sb.from("variation_items").update({ source_model_id: modelId }).eq("id", it.id);
        if (lErr) throw lErr;
      }
      idx++;
    }

    if (FIX) {
      const { error: tErr } = await sb.from("variation_types").update({ source_category_id: catId }).eq("id", typeId);
      if (tErr) throw tErr;
    }
  }

  console.log(FIX ? "\n✅ Done." : "\nDry run. Re-run with --fix to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
