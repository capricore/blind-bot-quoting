-- THE-772 — bind a quoted expedite fee to the quote contents it was priced against, so the fee stays
-- valid only while the quote is unchanged. Run in the Supabase SQL editor. Idempotent.
--
-- expedite_quoted_sig is a deterministic fingerprint of the lines (product, qty, unit price, sub-part
-- qtys) at the moment the admin set the fee. The app compares it to the live fingerprint: if they
-- differ the fee is "stale" (re-confirm needed); if the customer reverts the change it matches again
-- and the fee is restored automatically.
alter table public.quotes add column if not exists expedite_quoted_sig text;
