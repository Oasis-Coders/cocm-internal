-- cocm-internal meal payments: admin-recorded receipts + manual balance adjustments.
-- Outstanding balance per person per month = signup total - sum(amount).
--   kind = 'payment'    → money received from the member (amount always > 0)
--   kind = 'adjustment' → manual correction, signed amount:
--                          positive reduces what they owe (waiver/discount),
--                          negative increases what they owe (undercharge fix).
-- "Clearing" a balance is recorded as a payment equal to the outstanding
-- amount, so the ledger stays auditable; nothing is ever silently zeroed.

create table if not exists public.meal_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind text not null check (kind in ('payment', 'adjustment')),
  amount numeric(10, 2) not null check (amount <> 0),
  note text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists meal_payments_user_period_idx
  on public.meal_payments (user_id, period);

alter table public.meal_payments enable row level security;

-- Members see their own payment records; admin+ sees everyone's.
drop policy if exists meal_payments_read on public.meal_payments;
create policy meal_payments_read on public.meal_payments
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_any_role(array['admin', 'super_admin'])
  );

-- Only admin+ can record / correct payments.
drop policy if exists meal_payments_admin_write on public.meal_payments;
create policy meal_payments_admin_write on public.meal_payments
  for all to authenticated
  using (public.has_any_role(array['admin', 'super_admin']))
  with check (public.has_any_role(array['admin', 'super_admin']));

grant select, insert, update, delete on table public.meal_payments to authenticated;
