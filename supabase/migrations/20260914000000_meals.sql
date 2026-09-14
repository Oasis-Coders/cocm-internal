-- cocm-internal meals: per-day breakfast/lunch/dinner signup + monthly settlement.
-- This project SHARES the bookstore's Supabase project, so auth.users,
-- public.profiles, public.roles and public.user_roles already exist and are
-- owned there. This migration only adds the 'user' role row and the
-- meals-domain tables. It must not redefine the shared identity tables.

-- 1) New base role. For now 'user' has the same access as 'staff';
--    the two may diverge later.
--    The shared roles table has a CHECK limiting names to the original
--    three roles, so widen it minimally to admit 'user'. This grants
--    nothing in the bookstore app: all of its policies still require
--    staff/admin/super_admin explicitly.
alter table public.roles drop constraint if exists roles_name_check;
alter table public.roles
  add constraint roles_name_check
  check (name in ('staff', 'admin', 'super_admin', 'user'));

insert into public.roles (name)
values ('user')
on conflict (name) do nothing;

-- 2) Singleton settings: per-meal prices (admin-configurable) + transfer info.
create table if not exists public.meal_settings (
  id integer primary key default 1 check (id = 1),
  breakfast_price numeric(10, 2) not null default 0,
  lunch_price numeric(10, 2) not null default 0,
  dinner_price numeric(10, 2) not null default 0,
  currency text not null default 'GBP',
  transfer_info text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.meal_settings (id)
values (1)
on conflict (id) do nothing;

-- 3) Days on which meals are served, with per-meal availability.
create table if not exists public.meal_days (
  meal_date date primary key,
  breakfast_available boolean not null default true,
  lunch_available boolean not null default true,
  dinner_available boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

-- 4) Member signups. One row per person per meal (no guests).
--    price snapshots the configured price at signup time so later price
--    changes never rewrite history.
create table if not exists public.meal_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_date date not null references public.meal_days(meal_date) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, meal_date, meal_type)
);

create index if not exists meal_signups_user_date_idx
  on public.meal_signups (user_id, meal_date);
create index if not exists meal_signups_date_idx
  on public.meal_signups (meal_date);

alter table public.meal_settings enable row level security;
alter table public.meal_days enable row level security;
alter table public.meal_signups enable row level security;

-- Settings: everyone signed in can read; only admin+ can change.
drop policy if exists meal_settings_read on public.meal_settings;
create policy meal_settings_read on public.meal_settings
  for select to authenticated
  using (true);

drop policy if exists meal_settings_admin_write on public.meal_settings;
create policy meal_settings_admin_write on public.meal_settings
  for all to authenticated
  using (public.has_any_role(array['admin', 'super_admin']))
  with check (public.has_any_role(array['admin', 'super_admin']));

-- Meal days: everyone signed in can read; only admin+ can manage.
drop policy if exists meal_days_read on public.meal_days;
create policy meal_days_read on public.meal_days
  for select to authenticated
  using (true);

drop policy if exists meal_days_admin_write on public.meal_days;
create policy meal_days_admin_write on public.meal_days
  for all to authenticated
  using (public.has_any_role(array['admin', 'super_admin']))
  with check (public.has_any_role(array['admin', 'super_admin']));

-- Signups: members read their own; admin+ reads everyone's (statistics).
drop policy if exists meal_signups_read on public.meal_signups;
create policy meal_signups_read on public.meal_signups
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_any_role(array['admin', 'super_admin'])
  );

-- Members sign themselves up / cancel their own signup.
drop policy if exists meal_signups_self_insert on public.meal_signups;
create policy meal_signups_self_insert on public.meal_signups
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists meal_signups_self_delete on public.meal_signups;
create policy meal_signups_self_delete on public.meal_signups
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.has_any_role(array['admin', 'super_admin'])
  );

grant select on table public.meal_settings to authenticated;
grant update on table public.meal_settings to authenticated;
grant select, insert, update, delete on table public.meal_days to authenticated;
grant select, insert, delete on table public.meal_signups to authenticated;
