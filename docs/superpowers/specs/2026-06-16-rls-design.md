# Row-Level Security (RLS) — design

**Ticket:** THE-772 (production-grade ownership) · **Date:** 2026-06-16
**Branch:** `yanyan/the-772-rls`

## Why

Today the data layer (`lib/db.ts`) runs every query through the **service_role** client
(`admin()`), which **bypasses RLS**. Ownership is enforced only in app code (`canAccessOwned`
guards + `owner_id` filters). A single missed guard or filter leaks another retailer's
quotes/orders. This change makes the **database itself** enforce ownership, so retailer data
is protected even if app code slips — defense-in-depth, the standard Supabase model.

## Ownership model (unchanged)

- `quotes.owner_id` = the retailer (auth user id). `null` = public demo sample (visible to all).
- `quote_items` / `orders` / `order_events` inherit ownership via their parent quote.
- `profiles.role` = `admin` (back-office: Supplier Console, all orders) or `retailer`.

## Mechanism

RLS only applies to the **user-scoped client** (anon key + the user's JWT from cookies,
`lib/supabase/server.ts`). The **service_role** client still bypasses RLS by design.

So: route **retailer-facing reads/writes through the user-scoped client** (RLS enforces),
and keep **service_role** only for operations that legitimately need elevation:
- **seed** (creates demo rows with `owner_id null`),
- **ref numbering** (`nextRef` counts across *all* rows — a user-scoped count only sees its
  own rows and would collide),
- **back-office** (Supplier Console / `advance` / all-orders views — admin),
- **system reads** (`pricing_versions`, and `getProfile`/owner lookups used by guards).

### Data-layer refactor (low-churn)

Each shared query takes an optional client, defaulting to `admin()`:
```ts
export async function getQuote(id: number, sb: SupabaseClient = admin()) { … }
```
- **Retailer call sites** (pages/routes that act as the signed-in user) pass the user-scoped
  client: `const sb = await createClient(); await getQuote(id, sb)`. RLS applies.
- **Back-office / system call sites** call with no client → `admin()` → unchanged.

Functions switched to accept/use the user client at retailer call sites:
`getQuotes`, `getQuote`, `getDraftQuote`, `getOrCreateDraftQuote`, `addQuoteItem`,
`removeQuoteItem`, `submitPreOrder`, `getOrders(ownerId)`, `getOrder` (retailer detail),
`getRecentEvents(ownerId)`, `getOrderRefByQuote`.

Stay on `admin()`: `seed`, `nextRef`, `getActivePricing`, `getAllPricingVersions`,
`getProfile`, `getQuoteOwnerId`, `getOrderOwnerId`, `updateOrder` (supplier), and
back-office `getOrders()`/`getRecentEvents()` (no ownerId).

App-layer guards (`canAccessOwned`, `requireAdminPage`, `ownerId` filters) **stay** as
defense-in-depth.

## Policies (see `supabase/migrations/0001_rls.sql`)

`public.is_admin()` — `SECURITY DEFINER` helper: `true` if the caller's `profiles.role = 'admin'`.

| Table | SELECT | INSERT | UPDATE / DELETE |
|---|---|---|---|
| `profiles` | own or admin | own (`id = auth.uid()`) | own or admin |
| `pricing_versions` | admin only* | — | — |
| `quotes` | own, demo (`owner_id is null`), or admin | `owner_id = auth.uid()` | own or admin |
| `quote_items` | parent quote visible | parent quote owned, or admin | parent quote owned, or admin |
| `orders` | parent quote visible | parent quote owned (retailer submit) | admin only (supplier) |
| `order_events` | parent order visible | parent order owned, or admin | admin only |

\* the app reads pricing via `admin()`, so retailers never need a pricing SELECT; policy stays
admin-only. service_role (seed) bypasses for writes.

## Applying

No migration tooling in this repo — **run `supabase/migrations/0001_rls.sql` in the Supabase
SQL editor** (quote project). Idempotent (`drop policy if exists` + `create`).

## Verification

- `npm run build` + tsc clean.
- **Isolation (after SQL applied):** with the user-scoped client, user A cannot SELECT user
  B's quote/order/items (returns nothing); demo rows (`owner_id null`) remain visible; a user
  cannot INSERT a quote with someone else's `owner_id`; admin sees all.
- **Regression:** retailer flow (catalog → quote → pre-order) still works; Supplier Console
  (admin) still sees all orders and can advance them.

## Out of scope
- Moving pricing/back-office reads off service_role (they're admin-gated; left as-is).
- A Postgres sequence/RPC for ref numbering (kept on service_role count).
