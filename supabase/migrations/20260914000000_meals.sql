-- cocm-internal meals: published meal events + member signups.
-- This project SHARES the bookstore's Supabase project, so auth.users,
-- public.profiles, public.roles and public.user_roles already exist and are
-- owned there. This migration only adds the meals domain tables.

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meal_date date not null,
  signup_deadline timestamptz,
  price_per_person numeric,
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_signups (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  guest_count integer not null default 1 check (guest_count > 0),
  status text not null default 'registered' check (status in ('registered', 'cancelled')),
  signed_up_at timestamptz not null default now(),
  unique (meal_id, user_id)
);

alter table public.meals enable row level security;
alter table public.meal_signups enable row level security;

-- Meals are visible to every signed-in member.
drop policy if exists meals_read on public.meals;
create policy meals_read on public.meals
  for select to authenticated
  using (true);

-- Only staff+ can create / edit / close meals.
drop policy if exists meals_staff_write on public.meals;
create policy meals_staff_write on public.meals
  for insert to authenticated
  with check (public.has_any_role(array['staff', 'admin', 'super_admin']));

drop policy if exists meals_staff_update on public.meals;
create policy meals_staff_update on public.meals
  for update to authenticated
  using (public.has_any_role(array['staff', 'admin', 'super_admin']))
  with check (public.has_any_role(array['staff', 'admin', 'super_admin']));

drop policy if exists meals_staff_delete on public.meals;
create policy meals_staff_delete on public.meals
  for delete to authenticated
  using (public.has_any_role(array['staff', 'admin', 'super_admin']));

-- Members can read their own signups; staff+ can read everyone's (headcounts).
drop policy if exists meal_signups_read on public.meal_signups;
create policy meal_signups_read on public.meal_signups
  for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['staff', 'admin', 'super_admin']));

-- Members sign themselves up (optionally with guests).
drop policy if exists meal_signups_insert on public.meal_signups;
create policy meal_signups_insert on public.meal_signups
  for insert to authenticated
  with check (user_id = auth.uid());

-- Members can update / cancel their own signup; staff+ can adjust anyone's.
drop policy if exists meal_signups_update on public.meal_signups;
create policy meal_signups_update on public.meal_signups
  for update to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['staff', 'admin', 'super_admin']))
  with check (user_id = auth.uid() or public.has_any_role(array['staff', 'admin', 'super_admin']));

-- Members can delete their own signup; staff+ can delete anyone's.
drop policy if exists meal_signups_delete on public.meal_signups;
create policy meal_signups_delete on public.meal_signups
  for delete to authenticated
  using (user_id = auth.uid() or public.has_any_role(array['staff', 'admin', 'super_admin']));

grant select, insert, update, delete on table public.meals to authenticated;
grant select, insert, update, delete on table public.meal_signups to authenticated;
