# Accessory Catalog CMS — design (THE-772, Phase 2)

## Goal
Let an admin **build and edit the entire accessory (motor) catalog in-app**, instead of it
living in static TypeScript (`lib/accessories-data.ts`). Specifically: create/edit/delete
**Brands → Categories → Models**, and edit each model's **name, SKU, description, image,
default price, orderable flag, sort/active** — all DB-backed, with image upload.

## Scope
- **In scope:** the **accessory (A-OK motor) catalog** only — brands, categories, models.
- **Out of scope:** the full-product catalog (Roller Shade / Drapery in `catalog-data.ts`)
  and its pricing grids; that's a separate effort.
- Builds on what's already DB-backed and keyed by `model_id`: inventory (0004), per-retailer
  pricing (0004), tags (0002), Crown/Driver (0005). Those stay; this just moves the
  **catalog itself** under admin control.

## Data model (migration `0006_accessory_catalog.sql`)
```
accessory_brands(id text pk, name, tagline, sort, created_at)
accessory_categories(id text pk, brand_id → brands, name, blurb, orderable bool,
                     image_url, sort, created_at)
accessory_models(id text pk, category_id → categories, sku, name, description,
                 image_url, default_price numeric null, sort, active bool default true,
                 created_at)
```
- **RLS:** public read (catalog is public-facing); admin-only write. (Same pattern as tags.)
- **Seed from the current static data** in the same migration (or a one-time seeder), so
  the existing brand, 8 categories and 49 models carry over **with their exact current
  ids** (e.g. `aok-am15-03-35-es-e`). This is critical: inventory / prices / tags /
  crown-driver assignments and already-saved quote lines all reference these ids.

## The key architectural change (and the risk)
Today these are **synchronous, static** accessors used everywhere:
`getAccessoryCategories()`, `getAccessoryModels(cat?)`, `getAccessoryModel(id)`,
`getAccessoryCategory(id)`, `accessoryImage(model)`, `ACCESSORY_BRAND`.

Phase 2 makes them **DB-backed → async**. Every caller must `await`. Callers today:
- `app/(portal)/catalog/accessories/page.tsx` (server — easy)
- `app/(portal)/motors/page.tsx` (server — easy)
- `app/api/quote-items/route.ts` (accessory add — server)
- `lib/db/quotes.ts` `addAccessoryItem` (uses `getAccessoryCategory`)
- `lib/db/motors.ts` `orderableMotorIds`, `getEffectivePrices`, `resolveMotorPrice` (static price fallback)
- `app/(portal)/quotes/[id]` and order/excel display (reads category name off the stored
  `AccessoryConfig`, not the live model — so mostly unaffected; verify)

**Mitigation:** add a tiny request-scoped cache so one render doesn't hit the DB N times
(load brands/categories/models once per request, memoized). Keep a **static fallback**: if
the catalog tables are empty/missing (migration not run), fall back to the current static
data — so nothing breaks pre-migration, exactly like the other best-effort reads.

## Image upload
- A Supabase **Storage** bucket `accessory-images` (public read). Admin uploads via the
  authenticated client; store the public URL in `image_url`.
- `IMG_PROXY_ALLOWED_HOSTS` already proxies external images; the storage host is same-project.
- Need: bucket + an upload control in the admin form. Document the bucket in DEPLOY.md.

## Admin UI
Add a **"Catalog"** tab to the existing **Motors** hub (`/motors?tab=catalog`):
- Tree: Brand → Category → Model, each level add / rename / delete / reorder.
- Per-model form: name, SKU, description, default price, orderable, **image upload**, active.
- Deleting a model that has inventory/pricing/tag/quote references: block or soft-delete
  (`active=false`) rather than hard-delete, to avoid orphaning historical quotes. **Default
  to soft-delete (deactivate).**

## Id stability
- New brands/categories/models get generated slug ids (collision-safe), like tags do.
- Editing a model's SKU/name does **not** change its id (id is independent), so all the
  metadata keyed on `model_id` stays attached.
- Seeded rows keep the exact static ids.

## Phasing
- **2a — lift to DB (read-only, no behavior change):** create tables, seed from static,
  rewrite the accessors to read DB (with static fallback + per-request cache), `await` all
  callers. Ship + verify the whole app behaves identically. *(The risky cutover, isolated.)*
- **2b — admin editing:** the Catalog tab + image upload + create/edit/(soft)delete.

## Out of scope / later
- Full-product (roller/drapery) catalog CMS.
- Controller / Motor Asso / Final Product levels from Damon's diagram.
- Bulk import/export.

## Open questions (defaults chosen)
1. Accessories only — **yes** (confirmed).
2. Image hosting — **Supabase Storage** (confirmed).
3. `orderable` admin-togglable per category — **yes** (confirmed).
4. Delete semantics — **soft-delete (deactivate)** models with references; hard-delete only
   when unreferenced. (Proposed.)
