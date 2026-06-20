import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { setBankInfo, type BankInfo } from "@/lib/db";

/** Save the company bank-transfer details (shown to retailers paying by bank transfer). Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  try {
    const b = await req.json();
    const info: BankInfo = {
      bankName: String(b.bankName ?? "").trim(),
      accountName: String(b.accountName ?? "").trim(),
      accountNumber: String(b.accountNumber ?? "").trim(),
      routingNumber: String(b.routingNumber ?? "").trim(),
      swift: String(b.swift ?? "").trim(),
      instructions: String(b.instructions ?? "").trim(),
    };
    await setBankInfo(info);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
