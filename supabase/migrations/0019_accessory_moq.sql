-- THE-772 — per-product minimum order quantity (MOQ). Run in the Supabase SQL editor. Idempotent.
--
-- moq is an intrinsic property of the accessory model (e.g. a made-to-order motor with no stock
-- that must be ordered in batches), so it lives on accessory_models — it flows through loadCatalog
-- like any other model field, and is removed with the model row (no deleteModel change needed).
-- 0 = no minimum (the default).

alter table public.accessory_models add column if not exists moq integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accessory_models_moq_chk') then
    alter table public.accessory_models add constraint accessory_models_moq_chk check (moq >= 0);
  end if;
end $$;
