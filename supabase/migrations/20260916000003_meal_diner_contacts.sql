-- Per-account "names I've booked" history for one-tap guest re-booking.
-- Written on every successful booking made by a signed-in user. Unlike
-- meal_signups (deleted on cancellation), these rows persist, so a name a
-- staff member booked before stays available as a quick chip afterwards.
create table if not exists public.meal_diner_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  diner_id uuid not null references public.meal_diners(id) on delete cascade,
  last_booked_at timestamptz not null default now(),
  primary key (user_id, diner_id)
);

alter table public.meal_diner_contacts enable row level security;

drop policy if exists meal_diner_contacts_owner_rw on public.meal_diner_contacts;
create policy meal_diner_contacts_owner_rw
  on public.meal_diner_contacts
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists meal_diner_contacts_user_recency
  on public.meal_diner_contacts (user_id, last_booked_at desc);
