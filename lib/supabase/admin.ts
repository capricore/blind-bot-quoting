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

// Next.js wraps `fetch` in Server Components and MEMOIZES identical GETs within a single request
// (and may persist them in the Data Cache). Supabase queries run over `fetch`, so a read-modify-read
// in one request — e.g. invoice-number assignment does read(null) → write → read — would get the
// SAME memoized stale response on the second read and never see its own write. A database client
// must always hit the source, so we force every request to bypass both layers: `cache: "no-store"`
// (no Data Cache) plus a unique header per call (distinct options ⇒ React can't memoize/dedupe it).
let _seq = 0;
const uncachedFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("x-fresh", `${Date.now()}-${++_seq}`);
  return fetch(input, { ...init, cache: "no-store", headers });
};

export function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase data layer not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  _admin = createSupabaseClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: uncachedFetch },
  });
  return _admin;
}
