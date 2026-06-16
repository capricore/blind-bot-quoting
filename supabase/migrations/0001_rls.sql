-- THE-772 — Row-Level Security for the quote service.
-- Run in the Supabase SQL editor (quote project). Idempotent: safe to re-run.
--
-- Model: quotes.owner_id = retailer (auth uid); NULL = public demo sample.
-- quote_items / orders / order_events inherit ownership via the parent quote.
-- profiles.role = 'admin' (back-office) | 'retailer'.
--
-- RLS is enforced for the user-scoped (anon + JWT) client. The service_role client
-- (lib/supabase/admin.ts) bypasses RLS by design — used for seed, ref-numbering,
-- back-office, and system reads.

-- ---------- role column (no-op if already present) ----------
alter table public.profiles add column if not exists role text not null default 'retailer';

-- ---------- admin check (SECURITY DEFINER → reads profiles without RLS, no recursion) ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- enable RLS ----------
alter table public.profiles         enable row level security;
alter table public.pricing_versions enable row level security;
alter table public.quotes           enable row level security;
alter table public.quote_items      enable row level security;
alter table public.orders           enable row level security;
alter table public.order_events     enable row level security;

-- =========================================================
-- profiles
-- =========================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- =========================================================
-- pricing_versions  (app reads via service_role; admin-only otherwise)
-- =========================================================
drop policy if exists pricing_select on public.pricing_versions;
create policy pricing_select on public.pricing_versions
  for select using (public.is_admin());

-- =========================================================
-- quotes
-- =========================================================
drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select using (owner_id = auth.uid() or owner_id is null or public.is_admin());

drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert on public.quotes
  for insert with check (owner_id = auth.uid());

drop policy if exists quotes_update on public.quotes;
create policy quotes_update on public.quotes
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes
  for delete using (owner_id = auth.uid() or public.is_admin());

-- =========================================================
-- quote_items  (ownership via parent quote)
-- =========================================================
drop policy if exists quote_items_select on public.quote_items;
create policy quote_items_select on public.quote_items
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and (q.owner_id = auth.uid() or q.owner_id is null or public.is_admin())
    )
  );

drop policy if exists quote_items_insert on public.quote_items;
create policy quote_items_insert on public.quote_items
  for insert with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and (q.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists quote_items_update on public.quote_items;
create policy quote_items_update on public.quote_items
  for update using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and (q.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists quote_items_delete on public.quote_items;
create policy quote_items_delete on public.quote_items
  for delete using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and (q.owner_id = auth.uid() or public.is_admin())
    )
  );

-- =========================================================
-- orders  (ownership via parent quote; updates are supplier/admin only)
-- =========================================================
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (
    exists (
      select 1 from public.quotes q
      where q.id = orders.quote_id
        and (q.owner_id = auth.uid() or q.owner_id is null or public.is_admin())
    )
  );

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (
    exists (
      select 1 from public.quotes q
      where q.id = orders.quote_id
        and (q.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete using (public.is_admin());

-- =========================================================
-- order_events  (ownership via order → quote; inserts by owner or admin)
-- =========================================================
drop policy if exists order_events_select on public.order_events;
create policy order_events_select on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
      join public.quotes q on q.id = o.quote_id
      where o.id = order_events.order_id
        and (q.owner_id = auth.uid() or q.owner_id is null or public.is_admin())
    )
  );

drop policy if exists order_events_insert on public.order_events;
create policy order_events_insert on public.order_events
  for insert with check (
    exists (
      select 1 from public.orders o
      join public.quotes q on q.id = o.quote_id
      where o.id = order_events.order_id
        and (q.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists order_events_update on public.order_events;
create policy order_events_update on public.order_events
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_events_delete on public.order_events;
create policy order_events_delete on public.order_events
  for delete using (public.is_admin());
