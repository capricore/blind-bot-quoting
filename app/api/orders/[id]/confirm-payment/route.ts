import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/api";
import { markOrderPaid } from "@/lib/db";

const BUCKET = "payment-proofs";
const MAX_BYTES = 10 * 1024 * 1024;
const allowed = (type: string) => type.startsWith("image/") || type === "application/pdf";

/**
 * Admin confirms a bank-transfer payment. A proof file is REQUIRED — without it the order
 * cannot enter the pipeline. Uploads the receipt to the private payment-proofs bucket, then
 * marks the order paid (→ submitted). Admin only.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { data: ord } = await admin().from("orders").select("status, payment_method").eq("id", id).maybeSingle();
    if (!ord) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if ((ord as { status: string }).status !== "awaiting_payment") {
      return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 409 });
    }
    if ((ord as { payment_method: string | null }).payment_method !== "bank_transfer") {
      return NextResponse.json({ error: "Not a bank-transfer order" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "A bank-transfer receipt is required" }, { status: 400 });
    if (!allowed(file.type)) return NextResponse.json({ error: "Upload an image or PDF receipt" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File must be ≤ 10 MB" }, { status: 400 });

    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `orders/${id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin().storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) {
      const msg = /bucket/i.test(upErr.message)
        ? `Storage bucket "${BUCKET}" not found — create it (private) in Supabase first.`
        : upErr.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await markOrderPaid(id, { proofPath: path });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
