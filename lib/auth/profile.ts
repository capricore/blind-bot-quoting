import { createClient } from "@/lib/supabase/server";

/**
 * Ensure the signed-in user has a profile row, and (once) link it to a blind-bot
 * account by matching email. When a match is found we also pull the retailer's
 * blind-bot company name and store it on the profile, so the link is actually
 * useful (the portal shows the real account, not a hardcoded demo name).
 *
 * Safe to call repeatedly; any blind-bot failure (unreachable / no match) never
 * blocks login — the user just stays unlinked.
 */
export async function ensureProfileLinked(): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, blindbot_linked_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    });
  }

  // Link by email once: if blind-bot has a client for this email, record the link
  // and copy over their company name.
  if (!existing?.blindbot_linked_at && user.email) {
    const apiKey = await blindbotApiKey(user.email);
    if (apiKey) {
      const company = await blindbotCompany(apiKey);
      await supabase
        .from("profiles")
        .update({
          blindbot_linked_at: new Date().toISOString(),
          blindbot_email: user.email,
          ...(company ? { company } : {}),
        })
        .eq("id", user.id);
    }
  }
}

const base = () => (process.env.BLINDBOT_API_URL ?? "").replace(/\/$/, "");

/** blind-bot client api_key for this email, or null if no such client. */
async function blindbotApiKey(email: string): Promise<string | null> {
  if (!base()) return null;
  try {
    const res = await fetch(`${base()}/lookup-api-key?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { apiKey?: string } | null;
    return data?.apiKey || null;
  } catch {
    return null;
  }
}

/** blind-bot company name for an api_key (via the public client-config), or null. */
async function blindbotCompany(apiKey: string): Promise<string | null> {
  if (!base()) return null;
  try {
    const res = await fetch(`${base()}/client-config/${encodeURIComponent(apiKey)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { name?: string } | null;
    return data?.name?.trim() || null;
  } catch {
    return null;
  }
}
