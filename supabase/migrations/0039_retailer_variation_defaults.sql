-- 0039: per-customer default variation items ("kits").
--
-- Lets an admin pre-configure, FOR A SPECIFIC CUSTOMER, which variation sub-products auto-select
-- when that customer opens a model on the accessory page. This OVERRIDES the global per-model
-- default (`variation_product_items.is_default`) on a per-model basis: if a customer has any rows
-- here for a model, those win; otherwise the store-wide default applies. Built for low-literacy
-- customers who shouldn't have to figure out which parts go together.
--
-- Run once in the Supabase SQL editor (same as 0018 / 0038).

create table if not exists variation_retailer_defaults (
  retailer_id uuid not null references profiles(id)         on delete cascade,
  model_id    text not null references accessory_models(id) on delete cascade,
  item_id     text not null references variation_items(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (retailer_id, model_id, item_id)
);

create index if not exists variation_retailer_defaults_retailer_model_idx
  on variation_retailer_defaults (retailer_id, model_id);

alter table variation_retailer_defaults enable row level security;

-- A customer may read their own kit; admins read + write everyone's.
drop policy if exists vrd_select on variation_retailer_defaults;
create policy vrd_select on variation_retailer_defaults for select
  using (retailer_id = auth.uid() or is_admin());

drop policy if exists vrd_write on variation_retailer_defaults;
create policy vrd_write on variation_retailer_defaults for all
  using (is_admin()) with check (is_admin());
