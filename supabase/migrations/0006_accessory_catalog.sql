-- THE-772 — Accessory catalog moved into the DB (Phase 2a).
-- Run in the Supabase SQL editor (quote project), after 0001 (needs public.is_admin()).
-- Idempotent. DDL only — rows are seeded separately (from the current static catalog),
-- and until seeded the app falls back to the static data, so nothing breaks pre-seed.

create table if not exists public.accessory_brands (
  id          text primary key,
  name        text not null,
  tagline     text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.accessory_categories (
  id          text primary key,
  brand_id    text not null references public.accessory_brands(id) on delete cascade,
  name        text not null,
  blurb       text,
  orderable   boolean not null default false,
  image_url   text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists accessory_categories_brand_idx on public.accessory_categories(brand_id);

create table if not exists public.accessory_models (
  id            text primary key,
  category_id   text not null references public.accessory_categories(id) on delete cascade,
  sku           text not null,
  name          text not null,
  description   text,
  image_url     text,
  default_price numeric,         -- null = "included" / no standalone price
  sort          integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists accessory_models_category_idx on public.accessory_models(category_id);

-- RLS: everyone reads (public catalog); only admins write.
alter table public.accessory_brands     enable row level security;
alter table public.accessory_categories enable row level security;
alter table public.accessory_models     enable row level security;

drop policy if exists accessory_brands_select on public.accessory_brands;
create policy accessory_brands_select on public.accessory_brands for select using (true);
drop policy if exists accessory_brands_write on public.accessory_brands;
create policy accessory_brands_write on public.accessory_brands for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists accessory_categories_select on public.accessory_categories;
create policy accessory_categories_select on public.accessory_categories for select using (true);
drop policy if exists accessory_categories_write on public.accessory_categories;
create policy accessory_categories_write on public.accessory_categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists accessory_models_select on public.accessory_models;
create policy accessory_models_select on public.accessory_models for select using (true);
drop policy if exists accessory_models_write on public.accessory_models;
create policy accessory_models_write on public.accessory_models for all using (public.is_admin()) with check (public.is_admin());
