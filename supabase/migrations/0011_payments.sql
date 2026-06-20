-- THE-772 — order payments (Stripe / PayPal / bank transfer).
-- Run in the Supabase SQL editor. Idempotent.
--
-- Payment is a layer ALONGSIDE the fulfilment status machine: an order is created in
-- 'awaiting_payment' and only enters the pipeline ('submitted' → … → 'delivered') once paid
-- (Stripe/PayPal success, or an admin-verified bank transfer). Failure keeps it awaiting +
-- payment_status='failed' so the retailer can retry.

alter table public.orders add column if not exists payment_method     text;                              -- 'stripe' | 'paypal' | 'bank_transfer'
alter table public.orders add column if not exists payment_status     text not null default 'pending';   -- 'pending' | 'paid' | 'failed'
alter table public.orders add column if not exists payment_ref        text;                              -- gateway reference (PaymentIntent / Checkout / PayPal order id)
alter table public.orders add column if not exists amount             numeric;                           -- charged amount (snapshot of quote total at confirm)
alter table public.orders add column if not exists paid_at            timestamptz;
alter table public.orders add column if not exists payment_proof_path text;                              -- bank-transfer proof (private bucket payment-proofs)

-- Orders that predate payments are already in the pipeline → treat them as paid.
update public.orders set payment_status = 'paid' where status <> 'awaiting_payment' and payment_status <> 'paid';

-- ---------- app settings (admin-managed key/value; e.g. company bank details) ----------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- Any signed-in user may read (a retailer who picks bank transfer needs the bank details);
-- only admins write.
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select using (auth.uid() is not null);
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
