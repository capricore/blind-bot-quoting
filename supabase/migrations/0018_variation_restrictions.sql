-- THE-772 — variation compatibility restrictions: item↔item pairs that cannot be selected
-- together (e.g. a 1.5" Crown that doesn't fit a 1" Drive). Run in the Supabase SQL editor
-- AFTER 0010. Idempotent.
--
-- A restriction is a physical fact about two variation items, independent of which product
-- they're attached to — so it's stored globally, keyed by item id (not model id). The pair is
-- symmetric; we canonicalise as (item_lo < item_hi) so each incompatible pair is one row.
-- Both columns cascade from variation_items, so deleting an item (or its type) clears its
-- restrictions automatically — no deleteModel change needed (that guards model-id-keyed tables).

create table if not exists public.variation_item_restrictions (
  item_lo     text not null references public.variation_items(id) on delete cascade,
  item_hi     text not null references public.variation_items(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (item_lo, item_hi),
  check (item_lo < item_hi)
);
create index if not exists variation_item_restrictions_lo_idx on public.variation_item_restrictions(item_lo);
create index if not exists variation_item_restrictions_hi_idx on public.variation_item_restrictions(item_hi);

-- ---------- RLS: everyone reads (the quote-time selector needs it); only admins write ----------
alter table public.variation_item_restrictions enable row level security;

drop policy if exists variation_item_restrictions_select on public.variation_item_restrictions;
create policy variation_item_restrictions_select on public.variation_item_restrictions for select using (true);
drop policy if exists variation_item_restrictions_write on public.variation_item_restrictions;
create policy variation_item_restrictions_write on public.variation_item_restrictions for all using (public.is_admin()) with check (public.is_admin());
