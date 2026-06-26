"use client";

import { useRouter } from "next/navigation";
import type { AttributeWithValues } from "@/lib/db";

const BASE = "/catalog/accessories";

/** Retailer faceted filter for the accessory catalog. One dropdown per attribute (AND across),
 *  plus a minimum-order-quantity facet: ?moq=1 (has) / ?moq=0 (none). Free-text search lives in the
 *  models-column header (AccessorySearchBox); the ?q param is preserved here when filters change. */
export function AccessoryFilters({
  attributes,
  selected,
  moq,
  q,
  cat,
  quote,
}: {
  attributes: AttributeWithValues[];
  selected: Record<string, string>;
  moq: string; // "" = any, "1" = has a minimum, "0" = no minimum
  q: string; // preserved across filter changes
  cat?: string;
  quote?: number;
}) {
  const router = useRouter();
  const withValues = attributes.filter((a) => a.values.length > 0);

  const build = (sel: Record<string, string>, moqVal: string) => {
    const p = new URLSearchParams();
    if (cat) p.set("cat", cat);
    if (quote) p.set("quote", String(quote));
    for (const [k, v] of Object.entries(sel)) if (v) p.set(`t_${k}`, v);
    if (moqVal) p.set("moq", moqVal);
    if (q.trim()) p.set("q", q.trim());
    const qs = p.toString();
    return qs ? `${BASE}?${qs}` : BASE;
  };

  const setFilter = (attrId: string, valueId: string) => {
    const sel = { ...selected };
    if (valueId) sel[attrId] = valueId;
    else delete sel[attrId];
    router.push(build(sel, moq));
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {withValues.map((a) => (
        <label key={a.id} className="flex flex-col gap-1">
          <span className="px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{a.name}</span>
          <select
            value={selected[a.id] ?? ""}
            onChange={(e) => setFilter(a.id, e.target.value)}
            className="min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
          >
            <option value="">Any</option>
            {a.values.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className="px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
          Minimum order quantity
        </span>
        <select
          value={moq}
          onChange={(e) => router.push(build(selected, e.target.value))}
          className="min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
        >
          <option value="">Any</option>
          <option value="1">Has minimum order quantity</option>
          <option value="0">No minimum order quantity</option>
        </select>
      </label>
    </div>
  );
}
