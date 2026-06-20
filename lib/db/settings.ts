import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "@/lib/supabase/admin";

// THE-772 — admin-managed app settings (key/value). Currently: company bank-transfer details
// shown to a retailer who pays by bank transfer. Public-read (signed-in), admin-write via RLS.

export type BankInfo = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swift: string;
  instructions: string;
};

const EMPTY_BANK: BankInfo = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  routingNumber: "",
  swift: "",
  instructions: "",
};
const BANK_KEY = "bank_transfer";

export async function getBankInfo(sb: SupabaseClient = admin()): Promise<BankInfo> {
  const { data, error } = await sb.from("app_settings").select("value").eq("key", BANK_KEY).maybeSingle();
  if (error) return EMPTY_BANK; // table not present yet (0011 not run) → no details
  return { ...EMPTY_BANK, ...((data?.value as Partial<BankInfo>) ?? {}) };
}

export async function setBankInfo(info: BankInfo, sb: SupabaseClient = admin()): Promise<void> {
  const { error } = await sb
    .from("app_settings")
    .upsert({ key: BANK_KEY, value: info, updated_at: new Date().toISOString() });
  if (error) throw error;
}
