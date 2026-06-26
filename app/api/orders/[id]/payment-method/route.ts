import { NextResponse } from "next/server";
import { requireOrderAccessOrToken } from "@/lib/auth/api";
import { changeOrderPaymentMethod } from "@/lib/db";
import { admin } from "@/lib/supabase/admin";
import type { PaymentMethod } from "@/lib/types";

const METHODS: PaymentMethod[] = ["stripe", "paypal", "bank_transfer"];

/** Switch an unpaid order's payment method (retailer changed their mind before paying). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireOrderAccessOrToken(req, ctx);
  if (gate instanceof NextResponse) return gate;
  const { id } = gate;
  const body = await req.json().catch(() => ({}));
  const method = body.method as PaymentMethod | undefined;
  if (!method || !METHODS.includes(method)) {
    return NextResponse.json({ error: "Choose a valid payment method" }, { status: 400 });
  }
  try {
    // Ownership is enforced by the gate above; the update itself needs service_role (RLS allows
    // only admins to UPDATE orders).
    await changeOrderPaymentMethod(id, method, admin());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
