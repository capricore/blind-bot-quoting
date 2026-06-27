"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { usd } from "@/lib/format";
import { useShippingRecalc } from "./ShippingRecalcContext";
import { useToast } from "./Toast";
import { RemoveItemButton } from "./QuoteActions";
import { cx } from "./ui";

export type EditorVariation = {
  itemId: string;
  variationName: string;
  itemLabel: string;
  qty: number;
  /** Per-unit price of this sub-part (per motor). */
  price: number;
  /** Stock of the sub-part's source model (null = untracked / unlimited). */
  stock: number | null;
};

/** Stock label + tone for one row (motor or sub-part). null = untracked → no badge. */
function StockBadge({ stock }: { stock: number | null }) {
  if (stock === null) return null;
  const tone = stock <= 0 ? "text-red-500" : stock <= 5 ? "text-amber-600" : "text-muted";
  const label = stock <= 0 ? "Out of stock" : stock <= 5 ? `Only ${stock} left` : `${stock} in stock`;
  return <span className={cx("text-[11.5px] font-medium", tone)}>{label}</span>;
}

/** Typeable +/- stepper (mirrors the catalog one). Clamped to [min, max]. */
function Stepper({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={cx("inline-flex items-center rounded-lg border border-line", disabled && "opacity-60")}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease"
        className="px-2.5 py-1 text-ink-soft hover:text-ink disabled:opacity-30"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return;
          const n = Math.floor(Number(v));
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        onBlur={(e) => {
          const n = Math.floor(Number(e.target.value));
          onChange(Number.isNaN(n) ? min : Math.min(max, Math.max(min, n)));
        }}
        aria-label="Quantity"
        className="w-11 border-0 bg-transparent text-center text-[13px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase"
        className="px-2.5 py-1 text-ink-soft hover:text-ink disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

/**
 * In-quote editor for an accessory line: the motor qty and each per-motor sub-part qty, all with
 * live stock and limits. Every change re-prices the line server-side (config + computation snapshot)
 * and refreshes the totals; while in flight the pay button is held via the shared recalc flag.
 */
export function AccessoryLineEditor({
  itemId,
  qty: initialQty,
  motorStock,
  moq,
  variations: initialVariations,
}: {
  itemId: number;
  qty: number;
  motorStock: number | null;
  moq: number;
  variations: EditorVariation[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { setPending } = useShippingRecalc();
  const [qty, setQty] = useState(initialQty);
  const [vqty, setVqty] = useState<Record<string, number>>(
    () => Object.fromEntries(initialVariations.map((v) => [v.itemId, v.qty]))
  );
  // Busy spans the PATCH (`submitting`) AND the RSC re-render after it (`isPending`), so the shared
  // recalc flag (→ pay button) stays held continuously and the totals never go stale-but-payable.
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = submitting || isPending;
  useEffect(() => {
    setPending(busy);
  }, [busy, setPending]);

  const minQty = Math.max(1, moq);
  // The motor qty is capped by its own stock and by how many each sub-part can cover (per-motor qty).
  const maxQty = initialVariations.reduce(
    (cap, v) => (v.stock === null ? cap : Math.min(cap, Math.max(1, Math.floor(v.stock / (vqty[v.itemId] ?? 1))))),
    motorStock === null ? Infinity : motorStock
  );

  // Persist the current selection; revert + toast on failure (e.g. server stock 409).
  const commit = async (nextQty: number, nextVqty: Record<string, number>) => {
    const prevQty = qty;
    const prevVqty = vqty;
    setQty(nextQty);
    setVqty(nextVqty);
    setSubmitting(true);
    try {
      const r = await fetch("/api/quote-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          qty: nextQty,
          variationItems: initialVariations.map((v) => ({ itemId: v.itemId, qty: nextVqty[v.itemId] ?? 1 })),
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not update");
      }
      // Hold busy through the re-render so the pay button doesn't flash enabled on a stale total.
      startTransition(() => router.refresh());
    } catch (e) {
      setQty(prevQty);
      setVqty(prevVqty);
      toast((e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const setMotorQty = (v: number) => {
    if (v === qty) return;
    commit(v, vqty);
  };
  const setPartQty = (itemId: string, v: number) => {
    if (v === (vqty[itemId] ?? 1)) return;
    commit(qty, { ...vqty, [itemId]: v });
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      {initialVariations.length > 0 && (
        <div className="space-y-2.5">
          {initialVariations.map((v) => {
            const cur = vqty[v.itemId] ?? 1;
            const vMax = v.stock === null ? Infinity : Math.max(1, Math.floor(v.stock / Math.max(1, qty)));
            const hasCaption = v.price > 0 || v.stock !== null;
            return (
              <div key={v.itemId} className="flex items-center gap-4">
                {/* Identity + a single muted caption line (unit price · stock) */}
                <div className="min-w-0 flex-1">
                  <div className="break-words text-[12.5px] text-ink-soft">
                    <span className="text-muted">{v.variationName}:</span>{" "}
                    <span className="font-medium text-ink">{v.itemLabel}</span>
                  </div>
                  {hasCaption && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                      {v.price > 0 && <span>{usd(v.price)} each</span>}
                      {v.price > 0 && v.stock !== null && <span aria-hidden>·</span>}
                      <StockBadge stock={v.stock} />
                    </div>
                  )}
                </div>
                <Stepper value={cur} min={1} max={vMax} disabled={busy} onChange={(n) => setPartQty(v.itemId, n)} />
                {/* Extended price for this sub-part (per motor) */}
                <div className="w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">
                  {v.price > 0 ? usd(v.price * cur) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className={cx("flex items-center gap-4", initialVariations.length > 0 && "mt-3 border-t border-line pt-3")}>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-ink">Quantity</div>
          {moq > 0 && <div className="mt-0.5 text-[11px] text-muted">Min order {moq}</div>}
        </div>
        <Stepper value={qty} min={minQty} max={maxQty} disabled={busy} onChange={setMotorQty} />
        <div className="w-16 shrink-0 text-right">
          <RemoveItemButton itemId={itemId} />
        </div>
      </div>
    </div>
  );
}
