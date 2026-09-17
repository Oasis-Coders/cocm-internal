-- Volunteer diner identity (free meals), volunteer price, and camp meal times.
-- 2026-09-17: Luke asked for a distinct volunteer (义工) identity that always
-- prices at £0, plus per-meal clock times shown in the camp meal overview.

-- 1. Allow 'volunteer' identity on roster and signups.
alter table meal_diners drop constraint if exists meal_diners_identity_check;
alter table meal_diners
  add constraint meal_diners_identity_check
  check (identity in ('staff', 'staff_family', 'volunteer', 'friend', 'camp_mate', 'other'));

alter table meal_signups drop constraint if exists meal_signups_identity_check;
alter table meal_signups
  add constraint meal_signups_identity_check
  check (identity in ('staff', 'staff_family', 'volunteer', 'friend', 'camp_mate', 'other'));

-- 2. Volunteer meal price (defaults to free).
alter table meal_settings add column if not exists price_volunteer numeric not null default 0;

-- 3. Camp meal clock times (HH:MM), shown in the camp meal overview.
alter table meal_settings add column if not exists breakfast_time text not null default '08:00';
alter table meal_settings add column if not exists lunch_time text not null default '12:30';
alter table meal_settings add column if not exists dinner_time text not null default '18:00';
