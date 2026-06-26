import Link from "next/link";
import { AddAccessoryButton } from "@/components/AccessoryActions";
import { AccessoryFilters } from "@/components/AccessoryFilters";
import { AccessorySearchBox } from "@/components/AccessorySearchBox";
import { FrequentParts, type FrequentPart } from "@/components/FrequentParts";
import { Badge, Card, cx, PageHeader } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/user";
import {
  getAttributes,
  getEffectivePrices,
  getFrequentPartIds,
  getInventoryMap,
  getModelFilesMap,
  getModelTagMap,
  getProductDefaultsMap,
  getProductVariationMap,
  getRestrictions,
  getVariations,
  loadCatalog,
} from "@/lib/db";
import { usd } from "@/lib/format";

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  const quoteId =
    typeof sp.quote === "string" && Number.isInteger(Number(sp.quote)) ? Number(sp.quote) : undefined;
  const q = quoteId ? `&quote=${quoteId}` : "";

  const userId = await getCurrentUserId();
  const [catalog, attributes, tagMap, effectivePrices, inventory, variations, variationMap, filesMap, defaultsMap, restrictions, frequentRaw] = await Promise.all([
    loadCatalog(),
    getAttributes(),
    getModelTagMap(),
    getEffectivePrices(userId), // this retailer's price per motor (override → default → static)
    getInventoryMap(), // model_id → stock; absent = untracked
    getVariations(),
    getProductVariationMap(), // model_id → available variation item ids
    getModelFilesMap(), // model_id → spec/cert attachments
    getProductDefaultsMap(), // model_id → default variation item ids
    getRestrictions(), // item↔item incompatibility pairs (grey-out in the options modal)
    userId ? getFrequentPartIds(userId, 12) : Promise.resolve([]), // over-fetch; stale ids filtered below
  ]);

  // Enrich the frequently-ordered ids with the live catalog; drop any that are gone /
  // no longer orderable / unpriced so we never pin a stale suggestion, then keep the top 3.
  const frequentParts: FrequentPart[] = frequentRaw.flatMap(({ modelId, orderCount }) => {
    const model = catalog.model(modelId);
    if (!model) return [];
    const modelCat = catalog.category(model.categoryId);
    if (!modelCat?.orderable) return [];
    const price = effectivePrices[modelId] ?? model.price;
    if (price === null || price === undefined) return [];
    return [{
      modelId,
      name: model.name,
      sku: model.sku,
      image: catalog.image(model),
      price,
      orderCount,
      stock: modelId in inventory ? inventory[modelId] : null,
      availableItemIds: variationMap[modelId] ?? [],
      defaultItemIds: defaultsMap[modelId] ?? [],
      moq: model.moq ?? 0,
    }];
  }).slice(0, 3);
  const categories = catalog.categories;
  const activeCat = categories.find((c) => c.id === cat) ?? categories[0];

  // value id → label, for chips
  const valueLabel: Record<string, string> = {};
  for (const a of attributes) for (const v of a.values) valueLabel[v.id] = v.label;

  // active filters from ?t_<attrId>=<valueId>, plus the ?moq=1 "minimum-order only" toggle
  const selected: Record<string, string> = {};
  for (const a of attributes) {
    const v = sp[`t_${a.id}`];
    if (typeof v === "string" && v) selected[a.id] = v;
  }
  // minimum-order-quantity facet: "1" = only products with a minimum, "0" = only products without
  const moq = sp.moq === "1" ? "1" : sp.moq === "0" ? "0" : "";
  // free-text name/SKU search (raw for the input; lowercased for matching)
  const searchRaw = typeof sp.q === "string" ? sp.q.trim() : "";
  const search = searchRaw.toLowerCase();
  const filtering = Object.keys(selected).length > 0 || moq !== "" || search !== "";

  // Params the search box preserves (everything except q itself).
  const baseParams: Record<string, string> = {};
  if (cat) baseParams.cat = cat;
  if (quoteId) baseParams.quote = String(quoteId);
  for (const [k, v] of Object.entries(selected)) baseParams[`t_${k}`] = v;
  if (moq) baseParams.moq = moq;

  // When filtering, search ALL orderable motors across categories; otherwise browse the active category.
  const baseModels = filtering
    ? categories.filter((c) => c.orderable).flatMap((c) => catalog.modelsIn(c.id).map((m) => ({ model: m, cat: c })))
    : catalog.modelsIn(activeCat.id).map((m) => ({ model: m, cat: activeCat }));

  const filtered = filtering
    ? baseModels.filter(({ model }) => {
        const tags = new Set(tagMap[model.id] ?? []);
        const hasMoq = (model.moq ?? 0) > 0;
        if (moq === "1" && !hasMoq) return false;
        if (moq === "0" && hasMoq) return false;
        if (search && !`${model.name} ${model.sku}`.toLowerCase().includes(search)) return false;
        return Object.values(selected).every((valueId) => tags.has(valueId));
      })
    : baseModels;
  // Products with a minimum-order requirement sink to the bottom (stable sort keeps the rest in
  // their catalog order).
  const models = [...filtered].sort((a, b) => Number((a.model.moq ?? 0) > 0) - Number((b.model.moq ?? 0) > 0));

  return (
    <div>
      <PageHeader
        eyebrow="Catalog · Accessories"
        title="Parts & Accessories"
        description="Motors, controls and power — browse by brand and category, or filter motors by their attributes. Motors are orderable and add to the same quote as full products; other parts are reference for now."
      />

      {quoteId && (
        <div className="rise mb-4 flex items-center justify-between gap-3 rounded-xl border border-brass/40 bg-brass-soft/40 px-4 py-2.5 text-[13px] text-ink-soft">
          <span>Adding to your quote — pick a motor to add.</span>
          <Link href={`/quotes/${quoteId}`} className="shrink-0 font-medium text-brass hover:underline">
            Back to quote →
          </Link>
        </div>
      )}

      <FrequentParts parts={frequentParts} quoteId={quoteId} variations={variations} restrictions={restrictions} />

      <AccessoryFilters attributes={attributes} selected={selected} moq={moq} q={searchRaw} cat={cat} quote={quoteId} />

      {/* 3-level master-detail: Brand → Category → Models */}
      <div className="grid gap-4 lg:grid-cols-[200px_240px_1fr]">
        {/* L1 — Brand */}
        <div>
          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Brand</div>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 bg-[#1a2336] px-4 py-3 text-white">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">A</div>
              <div>
                <div className="text-sm font-semibold">{catalog.brand.name}</div>
                <div className="text-[10.5px] text-white/50">{catalog.brand.tagline}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* L2 — Category */}
        <div>
          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Category</div>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line/70">
              {categories.map((c) => {
                const count = catalog.modelsIn(c.id).length;
                const active = !filtering && c.id === activeCat.id;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/catalog/accessories?cat=${c.id}${q}`}
                      className={cx(
                        "flex items-center justify-between gap-2 px-4 py-3 transition-colors",
                        active ? "bg-[#fbf8f1]" : "hover:bg-[#faf9f5]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className={cx("truncate text-[13.5px] font-medium", active ? "text-brass" : "text-ink")}>
                          {c.name}
                        </div>
                        <div className="truncate text-[11px] text-muted">{count} models</div>
                      </div>
                      {c.orderable ? <Badge tone="green">Orderable</Badge> : <Badge tone="slate">Reference</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* L3 — Models */}
        <div>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {filtering ? `Filtered · ${models.length} motor${models.length === 1 ? "" : "s"}` : `${catalog.brand.name} · ${activeCat.name}`}
            </span>
            {!filtering && !activeCat.orderable && (
              <span className="text-[10.5px] text-muted">— reference only (not yet orderable)</span>
            )}
            <div className="ml-auto">
              <AccessorySearchBox q={searchRaw} baseParams={baseParams} />
            </div>
          </div>
          <Card className="overflow-hidden">
            {models.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted">No models match these filters.</div>
            ) : (
              <ul className="divide-y divide-line/70">
                {models.map(({ model, cat: modelCat }) => {
                  const tags = tagMap[model.id] ?? [];
                  const price = effectivePrices[model.id] ?? model.price;
                  const stock = model.id in inventory ? inventory[model.id] : null;
                  const moq = model.moq ?? 0;
                  const img = catalog.image(model);
                  return (
                    <li key={model.id} className="relative flex items-center gap-4 px-4 py-3.5">
                      {moq > 0 && (
                        <span className="absolute right-3 top-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800">
                          Minimum order quantity {moq}
                          <span className="group/moq relative flex size-3.5 cursor-help items-center justify-center rounded-full bg-amber-200 text-[9px] font-bold text-amber-900">
                            ?
                            <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 hidden w-max max-w-[220px] -translate-y-1/2 rounded-md bg-ink px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg group-hover/moq:block">
                              Out of stock — a minimum of {moq} units must be ordered.
                            </span>
                          </span>
                        </span>
                      )}
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={model.name}
                          className="size-14 shrink-0 rounded-xl bg-[#0e0e10] object-contain p-1.5"
                        />
                      ) : (
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#0e0e10] text-[10px] font-medium text-white/40">
                          No image
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-ink">{model.name}</span>
                          <span className="rounded bg-[#f1efe9] px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">
                            {model.sku}
                          </span>
                          {filtering && <span className="text-[10.5px] text-muted">{modelCat.name}</span>}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                          {model.description}
                        </p>
                        {tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-md bg-brass-soft px-1.5 py-0.5 text-[10.5px] font-medium text-[#8a6a39]"
                              >
                                {valueLabel[t] ?? t}
                              </span>
                            ))}
                          </div>
                        )}
                        {(filesMap[model.id] ?? []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {(filesMap[model.id] ?? []).map((f) => (
                              <a
                                key={f.id}
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft hover:border-ink"
                              >
                                📄 {f.kind === "certification" ? "Cert" : f.kind === "spec" ? "Spec" : "Doc"}: {f.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[15px] font-semibold tabular-nums text-ink">
                          {price === null ? "Incl." : usd(price)}
                        </div>
                        <div className="mt-1.5">
                          {modelCat.orderable && price !== null ? (
                            <AddAccessoryButton
                              modelId={model.id}
                              quoteId={quoteId}
                              stock={stock}
                              variations={variations}
                              availableItemIds={variationMap[model.id] ?? []}
                              defaultItemIds={defaultsMap[model.id] ?? []}
                              restrictions={restrictions}
                              minOrder={moq}
                            />
                          ) : (
                            <span className="text-[11px] text-muted">Reference</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <p className="mt-3 px-1 text-[11px] text-muted">
            Imported from A-OK 2025 pricing. Stock, pricing, tags and variations are managed by an admin under Admin · Motors.
          </p>
        </div>
      </div>
    </div>
  );
}
