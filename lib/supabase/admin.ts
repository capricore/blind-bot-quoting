import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service_role key (bypasses RLS).
 *
 * This backs the data layer (lib/db.ts). Use ONLY in server code — never import
 * into a client component. Unlike auth, the data layer cannot degrade gracefully:
 * a quoting app with no database can't run, so this throws if env is missing.
 */
// Untyped (no generated Database types) — the db layer casts query results to the
// domain types itself, and this keeps insert/update payloads from inferring `never`.
let _admin: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase data layer not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  _admin = createSupabaseClient(url, key, { auth: { persistSession: false } });
  return _admin;
}
