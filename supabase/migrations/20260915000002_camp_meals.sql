-- cocm-internal camp meals remodel (feedback 2026-09-15):
--   1) meal_diners: roster of everyone eating at the center (admin maintains).
--   2) meal_days.is_camp_day: manual camp marking (Google Calendar sync later).
--   3) Identity-based pricing: staff & staff family £3/meal, others £5/meal.
--   4) meal_signups: guest-capable (diner, identity, headcount, allergen confirm).
--   5) meal_payments: keyed by diner as well as legacy user.
-- Legacy rows are backfilled so history stays visible in the new UI.

-- 1) Roster ---------------------------------------------------------------
create table if not exists public.meal_diners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  identity text not null default 'other'
    check (identity in ('staff', 'staff_family', 'friend', 'camp_mate', 'other')),
  allergens text not null default '',
  is_active boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists meal_diners_active_name_idx
  on public.meal_diners (is_active, name);

alter table public.meal_diners enable row level security;

drop policy if exists meal_diners_read on public.meal_diners;
create policy meal_diners_read on public.meal_diners
  for select to authenticated
  using (true);

drop policy if exists meal_diners_admin_write on public.meal_diners;
create policy meal_diners_admin_write on public.meal_diners
  for all to authenticated
  using (public.has_any_role(array['admin', 'super_admin']))
  with check (public.has_any_role(array['admin', 'super_admin']));

grant select, insert, update, delete on table public.meal_diners to authenticated;

-- 2) Camp-day flag ---------------------------------------------------------
alter table public.meal_days
  add column if not exists is_camp_day boolean not null default false;

-- 3) Identity-based pricing ------------------------------------------------
alter table public.meal_settings
  add column if not exists price_staff numeric(10, 2) not null default 3.00,
  add column if not exists price_other numeric(10, 2) not null default 5.00;

-- 4) Guest-capable signups -------------------------------------------------
alter table public.meal_signups
  add column if not exists diner_id uuid references public.meal_diners(id) on delete set null,
  add column if not exists display_name text not null default '',
  add column if not exists identity text
    check (identity in ('staff', 'staff_family', 'friend', 'camp_mate', 'other')),
  add column if not exists headcount integer not null default 1 check (headcount >= 1),
  add column if not exists allergen_confirmed boolean not null default false,
  add column if not exists allergen_notes text not null default '',
  add column if not exists booked_by uuid references auth.users(id) on delete set null,
  add column if not exists device_id text;

alter table public.meal_signups
  alter column user_id drop not null;

-- Backfill diners from profiles that already have signup/payment history.
insert into public.meal_diners (name, identity, user_id)
select distinct
  coalesce(nullif(p.display_name, ''), split_part(p.email, '@', 1), '未命名'),
  'staff',
  p.id
from public.profiles p
where exists (select 1 from public.meal_signups s where s.user_id = p.id)
   or exists (select 1 from public.meal_payments m where m.user_id = p.id)
on conflict do nothing;

-- Backfill signup rows: link diner, snapshot display name/identity, booker.
update public.meal_signups s
set diner_id = d.id,
    display_name = d.name,
    identity = d.identity,
    booked_by = s.user_id
from public.meal_diners d
where d.user_id = s.user_id
  and s.diner_id is null;

-- Replace the old unique constraint with partial ones that allow guest rows.
alter table public.meal_signups
  drop constraint if exists meal_signups_user_id_meal_date_meal_type_key;

create unique index if not exists meal_signups_diner_unique
  on public.meal_signups (diner_id, meal_date, meal_type)
  where diner_id is not null;

create unique index if not exists meal_signups_legacy_unique
  on public.meal_signups (user_id, meal_date, meal_type)
  where user_id is not null and diner_id is null;

create index if not exists meal_signups_diner_date_idx
  on public.meal_signups (diner_id, meal_date);

-- Signup RLS: the daily signup sheet is community-visible (all signed in can
-- read); members write their own / guest bookings, admin writes everything.
drop policy if exists meal_signups_read on public.meal_signups;
create policy meal_signups_read on public.meal_signups
  for select to authenticated
  using (true);

drop policy if exists meal_signups_self_insert on public.meal_signups;
create policy meal_signups_insert on public.meal_signups
  for insert to authenticated
  with check (
    coalesce(user_id, booked_by) = auth.uid()
    or public.has_any_role(array['admin', 'super_admin'])
  );

drop policy if exists meal_signups_self_delete on public.meal_signups;
create policy meal_signups_delete on public.meal_signups
  for delete to authenticated
  using (
    user_id = auth.uid()
    or booked_by = auth.uid()
    or public.has_any_role(array['admin', 'super_admin'])
  );

-- 5) Payments keyed by diner ------------------------------------------------
alter table public.meal_payments
  add column if not exists diner_id uuid references public.meal_diners(id) on delete set null;

alter table public.meal_payments
  alter column user_id drop not null;

update public.meal_payments p
set diner_id = d.id
from public.meal_diners d
where d.user_id = p.user_id
  and p.diner_id is null;

create index if not exists meal_payments_diner_period_idx
  on public.meal_payments (diner_id, period);

drop policy if exists meal_payments_read on public.meal_payments;
create policy meal_payments_read on public.meal_payments
  for select to authenticated
  using (
    user_id = auth.uid()
    or diner_id in (select id from public.meal_diners where user_id = auth.uid())
    or public.has_any_role(array['admin', 'super_admin'])
  );
