"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VariationItem, VariationType } from "@/lib/db";
import { Button, Card, cx } from "./ui";

export type VariationProduct = { id: string; name: string; sku: string; categoryName: string };

async function call(method: string, body: unknown): Promise<void> {
  const r = await fetch("/api/motors/variations", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Request failed");
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/motors/catalog/image", { method: "POST", body: fd });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

const INPUT = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink";

export function VariationsAdmin({
  variations,
  products,
  assignment,
  defaults,
  exclusionGroups,
}: {
  variations: VariationType[];
  products: VariationProduct[];
  assignment: Record<string, string[]>;
  defaults: Record<string, string[]>;
  /** model_id → its exclusion groups (each a list of item ids; at most one per group is pickable). */
  exclusionGroups: Record<string, string[][]>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newType, setNewType] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* ---- manage variation types + items ---- */}
      <div className="space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Variations</h3>
        {variations.map((v) => (
          <TypeBlock key={v.id} type={v} />
        ))}
        <Card className="flex items-end gap-2 px-5 py-4">
          <label className="flex-1">
            <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-muted">New variation</span>
            <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. Bracket, Remote" className={cx(INPUT, "w-full")} />
          </label>
          <Button
            variant="primary"
            busy={busy}
            className="py-1.5 text-[12px]"
            onClick={() => newType.trim() && run(async () => { await call("POST", { entity: "type", name: newType }); setNewType(""); })}
          >
            Add variation
          </Button>
        </Card>
      </div>

      {/* ---- per-product assignment + exclusion groups ---- */}
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Products — available items &amp; exclusion groups</h3>
        <p className="text-[12px] text-muted">Pick which variation items each product can use; tap ★ on an item to make it the default (pre-selected at checkout). Then group items that can&apos;t be picked together — at most one item per group is selectable by the customer.</p>
        <Card className="divide-y divide-line">
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              variations={variations}
              assigned={assignment[p.id] ?? []}
              defaultIds={defaults[p.id] ?? []}
              groups={exclusionGroups[p.id] ?? []}
            />
          ))}
          {products.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No products yet.</p>}
        </Card>
      </div>
    </div>
  );
}

function TypeBlock({ type }: { type: VariationType }) {
  const router = useRouter();
  const [name, setName] = useState(type.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [iName, setIName] = useState("");
  const [iPrice, setIPrice] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); router.refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#fafaf7] px-5 py-3">
        <input value={name} onChange={(e) => setName(e.target.value)} className={cx(INPUT, "w-44 font-semibold")} />
        {type.pairGroup && (
          <span className="rounded-full bg-brass-soft px-2 py-0.5 text-[10px] font-medium text-[#8a6a39]">paired</span>
        )}
        <Button variant="primary" busy={busy} disabled={name === type.name} className="py-1.5 text-[12px]" onClick={() => run(() => call("PATCH", { entity: "type", id: type.id, name }))}>
          Save
        </Button>
        <button onClick={() => run(() => call("DELETE", { entity: "type", id: type.id }))} disabled={busy} className="ml-auto text-[11px] font-medium text-muted hover:text-red-500">
          Delete variation
        </button>
      </div>
      {err && <p className="px-5 pt-2 text-[11px] text-red-500">{err}</p>}
      <div className="space-y-1.5 px-5 py-4">
        {type.items.map((it) => (
          <ItemRow key={it.id} item={it} />
        ))}
        <div className="mt-2 flex items-end gap-2">
          <input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Item name" className={cx(INPUT, "flex-1")} />
          <div className="flex items-center rounded-lg border border-line px-2">
            <span className="text-xs text-muted">$</span>
            <input type="number" min={0} step="0.01" value={iPrice} onChange={(e) => setIPrice(e.target.value)} placeholder="0" className="w-16 bg-transparent px-1 py-1.5 text-sm text-ink outline-none" />
          </div>
          <Button variant="secondary" busy={busy} className="py-1 text-[12px]" onClick={() => iName.trim() && run(async () => { await call("POST", { entity: "item", variationId: type.id, name: iName, price: iPrice === "" ? 0 : Number(iPrice) }); setIName(""); setIPrice(""); })}>
            + Item
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ItemRow({ item }: { item: VariationItem }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [image, setImage] = useState(item.image ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = name !== item.name || Number(price) !== item.price || image !== (item.image ?? "");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); router.refresh(); } catch { /* surfaced by parent on reload */ } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-9 shrink-0 rounded-md border border-line object-cover" />
      ) : (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-line text-[9px] text-muted">img</div>
      )}
      <input value={name} onChange={(e) => setName(e.target.value)} className={cx(INPUT, "flex-1")} />
      <div className="flex items-center rounded-lg border border-line px-2">
        <span className="text-xs text-muted">$</span>
        <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-16 bg-transparent px-1 py-1.5 text-sm text-ink outline-none" />
      </div>
      <label className={cx("cursor-pointer rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-soft hover:border-ink", busy && "pointer-events-none opacity-50")}>
        {image ? "Change" : "Image"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run(async () => setImage(await uploadImage(f))); }} />
      </label>
      {image && <button onClick={() => setImage("")} className="text-[11px] text-muted hover:text-red-500">✕</button>}
      <Button variant="primary" busy={busy} disabled={!dirty} className="py-1 text-[12px]" onClick={() => run(() => call("PATCH", { entity: "item", id: item.id, name, price: Number(price), image }))}>
        Save
      </Button>
      <button onClick={() => run(() => call("DELETE", { entity: "item", id: item.id }))} disabled={busy} className="text-[11px] font-medium text-muted hover:text-red-500">
        Delete
      </button>
    </div>
  );
}

function ProductRow({
  product,
  variations,
  assigned,
  defaultIds,
  groups,
}: {
  product: VariationProduct;
  variations: VariationType[];
  assigned: string[];
  defaultIds: string[];
  groups: string[][];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(assigned));
  const [def, setDef] = useState<Set<string>>(new Set(defaultIds));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty =
    sel.size !== assigned.length ||
    assigned.some((id) => !sel.has(id)) ||
    def.size !== defaultIds.length ||
    defaultIds.some((id) => !def.has(id));

  const itemVariation = (id: string) => variations.find((v) => v.items.some((i) => i.id === id));

  const toggle = (id: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setDef((d) => { const n = new Set(d); n.delete(id); return n; }); // unassigned → can't be default
      } else next.add(id);
      return next;
    });
  };

  // Mark an item as the (single) default for its variation.
  const setDefault = (id: string) => {
    const v = itemVariation(id);
    setDef((prev) => {
      const next = new Set(prev);
      const already = next.has(id);
      if (v) for (const i of v.items) next.delete(i.id); // one default per variation
      if (!already) next.add(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await call("POST", { entity: "assignment", modelId: product.id, itemIds: [...sel], defaultItemIds: [...def] });
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen((o) => !o)} className="w-4 text-muted hover:text-ink" aria-label="Toggle">{open ? "▾" : "▸"}</button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-medium text-ink">{product.name}</div>
          <div className="truncate text-[11px] text-muted">{product.categoryName} · {product.sku}</div>
        </div>
        <span className="text-[11px] text-muted">{sel.size} item{sel.size === 1 ? "" : "s"}</span>
      </div>
      {open && (
        <div className="mt-2.5 space-y-3 pl-7">
          {variations.map((v) => (
            <div key={v.id}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {v.name}{v.pairGroup && <span className="ml-1.5 font-normal normal-case text-[10px] text-[#8a6a39]">(paired)</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {v.items.map((it) => {
                  const on = sel.has(it.id);
                  const isDefault = def.has(it.id);
                  return (
                    <span
                      key={it.id}
                      className={cx(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                        on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-soft"
                      )}
                    >
                      <button onClick={() => toggle(it.id)} className="hover:opacity-80">
                        {it.name}{it.price ? ` · $${it.price}` : ""}
                      </button>
                      {on && (
                        <button
                          onClick={() => setDefault(it.id)}
                          title={isDefault ? "Default — click to clear" : "Set as default (pre-selected at checkout)"}
                          className={cx("text-[13px] leading-none", isDefault ? "text-amber-300" : "text-white/40 hover:text-white/80")}
                        >
                          {isDefault ? "★" : "☆"}
                        </button>
                      )}
                    </span>
                  );
                })}
                {v.items.length === 0 && <span className="text-[11px] text-muted">no items yet</span>}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button variant="primary" busy={busy} disabled={!dirty} className="py-1 text-[12px]" onClick={save}>Save assignment</Button>
            {err && <span className="text-[11px] text-red-500">{err}</span>}
          </div>

          <ExclusionGroupsEditor
            modelId={product.id}
            items={variations.flatMap((v) =>
              v.items.filter((i) => assigned.includes(i.id)).map((i) => ({ id: i.id, name: i.name, typeName: v.name }))
            )}
            initial={groups}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Per-model exclusion groups. Each group is a set of this product's assigned items; the customer
 * may pick at most one item from a group (mutual exclusion). Build a group by toggling chips
 * (motors-tags style); a model can have several groups. Saved independently of the assignment.
 */
function ExclusionGroupsEditor({
  modelId,
  items,
  initial,
}: {
  modelId: string;
  items: { id: string; name: string; typeName: string }[];
  initial: string[][];
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<string[][]>(() => initial.map((g) => [...g]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Compare ignoring group/item order, and only counting groups that will actually persist (≥2).
  const norm = (gs: string[][]) =>
    JSON.stringify(
      gs
        .map((g) => [...new Set(g)].sort())
        .filter((g) => g.length >= 2)
        .map((g) => g.join(","))
        .sort()
    );
  const dirty = norm(groups) !== norm(initial);

  const nameOf = (id: string) => items.find((it) => it.id === id)?.name ?? id;
  const toggle = (gi: number, id: string) =>
    setGroups((gs) => gs.map((g, i) => (i !== gi ? g : g.includes(id) ? g.filter((x) => x !== id) : [...g, id])));
  const addGroup = () => setGroups((gs) => [...gs, []]);
  const removeGroup = (gi: number) => setGroups((gs) => gs.filter((_, i) => i !== gi));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await call("POST", { entity: "exclusion-group", modelId, groups: groups.filter((g) => g.length >= 2) });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 border-t border-line pt-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Exclusion groups</span>
        <span className="text-[10.5px] text-muted">— items in a group can&apos;t be picked together</span>
      </div>
      {items.length < 2 ? (
        <p className="text-[11px] text-muted">Assign at least two items to this product first.</p>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-lg border border-line bg-[#fafaf7] px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">Group {gi + 1}</span>
                <button onClick={() => removeGroup(gi)} className="text-[11px] text-muted hover:text-red-500">Remove group</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((it) => {
                  const on = g.includes(it.id);
                  return (
                    <button
                      key={it.id}
                      onClick={() => toggle(gi, it.id)}
                      title={it.typeName}
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                        on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-soft hover:border-ink"
                      )}
                    >
                      {it.name}
                    </button>
                  );
                })}
              </div>
              {g.length === 1 && (
                <p className="mt-1.5 text-[10.5px] text-amber-600">Pick at least two — a one-item group does nothing.</p>
              )}
              {g.length >= 2 && (
                <p className="mt-1.5 text-[10.5px] text-muted">Pick at most one of: {g.map(nameOf).join(", ")}</p>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              onClick={addGroup}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brass hover:underline"
            >
              + Add group
            </button>
            <Button variant="secondary" busy={busy} disabled={!dirty} className="py-1 text-[12px]" onClick={save}>
              Save groups
            </Button>
            {err && <span className="text-[11px] text-red-500">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
