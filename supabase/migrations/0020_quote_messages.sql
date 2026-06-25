-- THE-772 — tag support-chat messages with the quote they're about.
-- Run in the Supabase SQL editor (quote project). Idempotent: safe to re-run.
--
-- A retailer opens a quote and messages us "about this quote" from a floating chat bubble.
-- The message still lives in the retailer's one support conversation (no per-quote threads),
-- but carries the quote it refers to so both sides see a "Re: Q-…" chip. quote_ref is a
-- denormalized snapshot of the ref so the chip still renders after a draft quote is deleted
-- (quote_id then goes null via the FK, matching the app's snapshot-the-product convention).

alter table public.messages add column if not exists quote_id  bigint;
alter table public.messages add column if not exists quote_ref text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_quote_fk') then
    alter table public.messages add constraint messages_quote_fk
      foreign key (quote_id) references public.quotes(id) on delete set null;
  end if;
end $$;

create index if not exists messages_quote_idx on public.messages(quote_id);
