import { NextResponse } from "next/server";
import { getActivePricing, getLine, getProduct } from "@/lib/db";
import { computeQuote, PricingError } from "@/lib/pricing";
import type { ItemConfig } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { productId: string; config: ItemConfig };
    const product = getProduct(body.productId);
    if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 404 });
    const line = getLine(product.lineId)!;
    const pricing = await getActivePricing(product.lineId);
    const computation = computeQuote(line, product, body.config, pricing.config, pricing.version);
    return NextResponse.json({ computation });
  } catch (err) {
    const status = err instanceof PricingError ? 422 : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
