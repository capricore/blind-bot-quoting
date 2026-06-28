-- THE-772 — per-model variation exclusion groups. Supersedes the global pairwise
-- variation_item_restrictions (0018) with a richer, per-product model: an exclusion group is a
-- SET of variation items attached to ONE accessory model, and at most one item from a group may be
-- picked in a config (i.e. the selected items in a group are mutually exclusive). A model can have
-- many groups, and a group may span variation types (e.g. some Crowns + some Drives together).
-- Run in the Supabase SQL editor AFTER 0018. Idempotent.

create table if not exists public.variation_exclusion_groups (
  id          text primary key default gen_random_uuid()::text,
  model_id    text not null references public.accessory_models(id) on delete cascade,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists variation_exclusion_groups_model_idx on public.variation_exclusion_groups(model_id);

create table if not exists public.variation_exclusion_group_items (
  group_id  text not null references public.variation_exclusion_groups(id) on delete cascade,
  item_id   text not null references public.variation_items(id) on delete cascade,
  primary key (group_id, item_id)
);
create index if not exists variation_exclusion_group_items_item_idx on public.variation_exclusion_group_items(item_id);

-- ---------- RLS: everyone reads (the quote-time selector needs it); only admins write ----------
alter table public.variation_exclusion_groups enable row level security;
alter table public.variation_exclusion_group_items enable row level security;

drop policy if exists variation_exclusion_groups_select on public.variation_exclusion_groups;
create policy variation_exclusion_groups_select on public.variation_exclusion_groups for select using (true);
drop policy if exists variation_exclusion_groups_write on public.variation_exclusion_groups;
create policy variation_exclusion_groups_write on public.variation_exclusion_groups for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists variation_exclusion_group_items_select on public.variation_exclusion_group_items;
create policy variation_exclusion_group_items_select on public.variation_exclusion_group_items for select using (true);
drop policy if exists variation_exclusion_group_items_write on public.variation_exclusion_group_items;
create policy variation_exclusion_group_items_write on public.variation_exclusion_group_items for all using (public.is_admin()) with check (public.is_admin());

-- ---------- one-time migration of the legacy global pairwise restrictions ----------
-- For each blocked pair (item_lo, item_hi) and each model that has BOTH items assigned, create a
-- 2-item exclusion group. Deterministic group id (md5 of model|lo|hi) keeps the two inserts
-- correlated and the whole block re-runnable. Guarded so it only seeds when no groups exist yet —
-- re-running the migration after admins have edited groups won't resurrect converted pairs.
do $$
begin
  if not exists (select 1 from public.variation_exclusion_groups) then
    with pairs as (
      select r.item_lo, r.item_hi, a.model_id,
             md5(a.model_id || '|' || r.item_lo || '|' || r.item_hi) as gid
      from public.variation_item_restrictions r
      join public.variation_product_items a on a.item_id = r.item_lo
      join public.variation_product_items b on b.item_id = r.item_hi and b.model_id = a.model_id
    )
    insert into public.variation_exclusion_groups (id, model_id)
    select distinct gid, model_id from pairs
    on conflict (id) do nothing;

    with pairs as (
      select r.item_lo, r.item_hi, a.model_id,
             md5(a.model_id || '|' || r.item_lo || '|' || r.item_hi) as gid
      from public.variation_item_restrictions r
      join public.variation_product_items a on a.item_id = r.item_lo
      join public.variation_product_items b on b.item_id = r.item_hi and b.model_id = a.model_id
    )
    insert into public.variation_exclusion_group_items (group_id, item_id)
    select gid, item_lo from pairs
    union
    select gid, item_hi from pairs
    on conflict do nothing;
  end if;
end $$;
