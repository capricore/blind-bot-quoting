import { NextResponse } from "next/server";
import { requireQuoteAccess } from "@/lib/auth/api";
import { admin } from "@/lib/supabase/admin";
import {
  cancelExpedite,
  getOrCreateConversationForRetailer,
  getProduct,
  getQuote,
  getQuoteOwnerId,
  getVariationItemModelMap,
  loadCatalog,
  requestExpedite,
  sendExpediteRequest,
  type ExpediteLine,
} from "@/lib/db";
import { computeShipping, type MotorRate } from "@/lib/shipping";
import { isAccessoryConfig } from "@/lib/types";

/**
 * Expedite-pricing request lifecycle (owner/admin only, RLS via requireQuoteAccess).
 * Body: { action: "request" | "cancel" }
 *  - "request": flag the quote 'requested' and drop a special card into the retailer's support chat
 *    carrying a snapshot of the system reference fee (sum of per-line expedite rates) for the admin
 *    to price against. Does NOT touch the legacy `expedite` boolean.
 *  - "cancel": withdraw the request → 'none'.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireQuoteAccess(ctx);
  if (gate instanceof NextResponse) return gate;
  const { id, sb } = gate;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === "cancel") {
      await cancelExpedite(id, sb);
      return NextResponse.json({ ok: true });
    }

    // action === "request" (default)
    const quote = await getQuote(id, sb);
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    // Reference fee = the old per-line accumulation, always-charged (rawAmount ignores waivers).
    const [catalog, itemModelMap] = await Promise.all([loadCatalog(), getVariationItemModelMap()]);
    const itemRates: Record<string, MotorRate> = {};
    for (const [itemId, modelId] of Object.entries(itemModelMap)) {
      const m = catalog.model(modelId);
      if (m) itemRates[itemId] = { shipGround: m.shipGround, shipExpedite: m.shipExpedite, shipMode: m.shipMode };
    }
    const refFee = computeShipping(quote.items, catalog, itemRates, true, quote.total, {
      ground: false,
      expedite: false,
    }).rawAmount;

    // Drop the request card into the owner's support conversation (admin client → routes to inbox
    // even when an admin triggered it acting-as the retailer). Public/demo quotes have no owner →
    // just flag the status.
    const ownerId = await getQuoteOwnerId(id);
    if (ownerId) {
      const conv = await getOrCreateConversationForRetailer(ownerId, admin());
      const units = quote.items.reduce((s, i) => s + i.qty, 0);
      // Snapshot every line's qty + price (and each accessory's sub-parts broken out) so the request
      // shows the full breakdown even if the quote is edited later (getProduct is a synchronous
      // static-catalog lookup).
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const lines: ExpediteLine[] = quote.items.map((it) => {
        // The unit = main product + its per-unit sub-parts; unitPrice is that combined each-price and
        // qty is how many units were ordered (lineTotal = unitPrice × qty). Sub-parts are listed only
        // as per-unit composition (e.g. 7 crowns + 3 drives per motor) — not multiplied by order qty.
        const unitPrice = it.computation.unitPrice;
        const subs = isAccessoryConfig(it.config)
          ? (it.config.variations ?? []).map((v) => ({
              name: `${v.variationName} · ${v.itemLabel}`,
              qty: v.qty ?? 1,
              unitPrice: v.price ?? 0,
            }))
          : undefined;
        const name = isAccessoryConfig(it.config) ? it.config.name : getProduct(it.productId)?.name ?? "Item";
        return { name, qty: it.qty, unitPrice, lineTotal: r2(unitPrice * it.qty), subs };
      });
      const summary = `Requested expedited shipping for ${quote.ref}.`;
      await sendExpediteRequest(
        conv.id,
        ownerId,
        { id, ref: quote.ref },
        summary,
        refFee,
        { items: lines, subtotal: quote.total, units },
        admin()
      );
    }
    await requestExpedite(id, sb);
    return NextResponse.json({ ok: true, refFee });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
