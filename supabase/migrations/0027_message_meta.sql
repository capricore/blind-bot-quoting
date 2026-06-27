-- THE-772 — structured payload for special chat messages. Run in the Supabase SQL editor.
-- Idempotent. Currently holds the expedite-request card's line-item snapshot
-- ({ items: [{name, qty, unitPrice, lineTotal}], subtotal, units }) so the request shows each
-- product's qty + price even if the quote is edited later (snapshot, per the app's convention).
alter table public.messages add column if not exists meta jsonb;
