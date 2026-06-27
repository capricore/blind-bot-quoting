// THE-772 — supplier-facing Purchase Order document, rendered per brand from an order's lines.
// Unlike the customer invoice (lib/invoice.ts) this is for reconciling GOODS with the supplier:
// no payment, no shipping, no discount — just the physical parts (main motor + each accessory
// sub-part broken out) with their counts and unit prices. The issuing party (buyer) is our own
// white-label brand; the vendor is just the brand string (A-OK / B-OK …).
import { getLine, getProduct } from "./db";
import { describeConfig } from "./describe";
import { isAccessoryConfig, type QuoteItemRow } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One row of the PO's parts table — a main product/motor, or a broken-out accessory sub-part. */
export type PurchaseOrderRow = {
  name: string;
  sku: string | null;
  detail: string;
  qty: number;
  rate: number;
  amount: number;
  /** True for accessory sub-parts (crown/drive…) so they can be visually indented under the motor. */
  sub?: boolean;
};

/**
 * Break an order's (brand-filtered) lines into supplier reconciliation rows. An accessory motor is
 * split into the motor itself (priced net of its sub-parts) plus one row per variation sub-part,
 * each with its real physical count (motorQty × per-motor qty). A plain product is a single row.
 * The rows' amounts always sum back to Σ(unitPrice × qty) — i.e. the brand's goods subtotal.
 */
export function buildPurchaseOrderRows(items: QuoteItemRow[]): PurchaseOrderRow[] {
  const rows: PurchaseOrderRow[] = [];
  for (const item of items) {
    const cfg = item.config;
    if (isAccessoryConfig(cfg)) {
      const variations = cfg.variations ?? [];
      const subTotalPerMotor = variations.reduce((s, v) => s + (v.price ?? 0) * (v.qty ?? 1), 0);
      const motorRate = round2(item.computation.unitPrice - subTotalPerMotor);
      rows.push({
        name: cfg.name,
        sku: cfg.sku,
        detail: [cfg.brand, cfg.category].filter(Boolean).join(" · "),
        qty: item.qty,
        rate: motorRate,
        amount: round2(motorRate * item.qty),
      });
      for (const v of variations) {
        const qty = item.qty * (v.qty ?? 1);
        rows.push({
          name: v.itemLabel,
          sku: null,
          detail: `${cfg.name} · ${v.variationName}`,
          qty,
          rate: v.price ?? 0,
          amount: round2((v.price ?? 0) * qty),
          sub: true,
        });
      }
      continue;
    }
    const product = getProduct(item.productId);
    const line = product ? getLine(item.lineId) : null;
    const rate = item.computation.unitPrice;
    const base = { qty: item.qty, rate, amount: round2(rate * item.qty), sku: product?.sku ?? null };
    if (!product || !line) {
      rows.push({ ...base, name: "Custom product", detail: "" });
      continue;
    }
    const d = describeConfig(line, product, cfg);
    rows.push({
      ...base,
      name: product.name,
      detail: [line.name, d.colorName, d.opacityLabel, ...d.options, d.dims].filter(Boolean).join(" · "),
    });
  }
  return rows;
}
