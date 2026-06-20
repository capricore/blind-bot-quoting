-- THE-772 — Product "variations": admin-managed, priced, per-product options.
-- Run in the Supabase SQL editor AFTER 0005 (migrates Crown/Drive data) and 0006 (assigns to
-- catalog models). Idempotent.
--
-- Model (mirrors the tag system, but priced + selectable at quote time):
--   variation_types          — a variation dimension, e.g. "Crown", "Drive", or a custom one.
--                              Types sharing a non-null `pair_group` are chosen together
--                              (all-or-none) at quote time — Crown + Drive do.
--   variation_items          — a priced option within a type (price added to the line).
--   variation_product_items  — which items are available for a given accessory model.
--
-- Crown + Drive are seeded here from the old motor_crown_options / motor_driver_options and
-- default-assigned to every orderable model, so existing behaviour carries over. Existing quote
-- lines snapshot their selection, so they are unaffected regardless.

create table if not exists public.variation_types (
  id          text primary key,
  name        text not null,
  pair_group  text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.variation_items (
  id            text primary key,
  variation_id  text not null references public.variation_types(id) on delete cascade,
  name          text not null,
  price         numeric not null default 0,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists variation_items_variation_idx on public.variation_items(variation_id);

create table if not exists public.variation_product_items (
  model_id    text not null,
  item_id     text not null references public.variation_items(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (model_id, item_id)
);
create index if not exists variation_product_items_model_idx on public.variation_product_items(model_id);

-- ---------- RLS: everyone reads (selector + prices); only admins write ----------
alter table public.variation_types         enable row level security;
alter table public.variation_items         enable row level security;
alter table public.variation_product_items enable row level security;

drop policy if exists variation_types_select on public.variation_types;
create policy variation_types_select on public.variation_types for select using (true);
drop policy if exists variation_types_write on public.variation_types;
create policy variation_types_write on public.variation_types for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists variation_items_select on public.variation_items;
create policy variation_items_select on public.variation_items for select using (true);
drop policy if exists variation_items_write on public.variation_items;
create policy variation_items_write on public.variation_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists variation_product_items_select on public.variation_product_items;
create policy variation_product_items_select on public.variation_product_items for select using (true);
drop policy if exists variation_product_items_write on public.variation_product_items;
create policy variation_product_items_write on public.variation_product_items for all using (public.is_admin()) with check (public.is_admin());

-- ---------- migrate existing Crown / Drive into built-in variations ----------
insert into public.variation_types (id, name, pair_group, sort) values
  ('crown', 'Crown', 'crown-drive', 0),
  ('drive', 'Drive', 'crown-drive', 1)
on conflict (id) do nothing;

insert into public.variation_items (id, variation_id, name, price, sort)
  select 'crown-' || id, 'crown', label, price_delta, sort from public.motor_crown_options
on conflict (id) do nothing;

insert into public.variation_items (id, variation_id, name, price, sort)
  select 'drive-' || id, 'drive', label, price_delta, sort from public.motor_driver_options
on conflict (id) do nothing;

-- default-assign every Crown/Drive item to every orderable accessory model
insert into public.variation_product_items (model_id, item_id)
  select m.id, vi.id
  from public.accessory_models m
  join public.accessory_categories c on c.id = m.category_id and c.orderable = true
  cross join public.variation_items vi
  where vi.variation_id in ('crown', 'drive')
on conflict do nothing;
