# Product Scope

## In scope (scaffold)

- Sign-in / sign-up with Supabase Auth, shared account with the Bookstore app
- Role-based access (`user` / `staff` / `admin` / `super_admin`); `user` currently has the same access as `staff`
- Bilingual (中文/EN) shell: dashboard, profile, admin
- User management: list members, grant/revoke roles (super_admin)

## Meal signup (live, 2026-09-14)

Product decisions confirmed by Luke:

1. Pricing: admin configures per-meal prices (breakfast / lunch / dinner); price is snapshotted at signup time so later changes never rewrite history.
2. Guests: not allowed — one signup per person per meal.
3. Cadence: admin creates meal days manually and toggles which meals are served each day.
4. Collection: statistics only — no online payment. The Meals page shows each member's month-to-date total plus admin-editable transfer instructions.

Tables: `meal_settings` (singleton: prices + transfer info), `meal_days` (date + per-meal availability), `meal_signups` (user × date × meal, price snapshot). RLS: members read everything and manage only their own signups; admin/super_admin manage days/prices/transfer info and read all signups for the monthly settlement stats.

Pages:

- `/meals` — member view: month-to-date total, transfer info, upcoming days with tap-to-toggle 早/中/晚 signup.
- `/meals/manage` (admin/super_admin) — price settings, transfer info editor, meal-day management, per-person monthly settlement table.

## Explicitly out of scope for now

- Camp/event/check-in/inventory/task features (removed with the Camp App)
- Online payments
- Diverging `user` vs `staff` access (same for now)
