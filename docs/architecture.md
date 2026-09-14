# Architecture

## Shape

- Next.js 15 App Router application (`app/`), React 19, Tailwind CSS.
- Supabase for auth + Postgres; all data access goes through RLS.
- **Shared Supabase project with the COCM Bookstore app.** `auth.users`,
  `profiles`, `roles`, `user_roles` and the `has_any_role()` helper are owned
  by the bookstore's migrations. This repo's migrations only add domain tables
  (`meals`, `meal_signups`) and never redefine shared tables.

## Auth & roles

- Email/password via Supabase Auth (`app/sign-in`, `app/sign-up`, `app/auth/callback`).
- `middleware.ts` redirects unauthenticated users to `/sign-in` for
  `/dashboard`, `/meals`, `/profile`, `/admin`; `/admin` additionally requires
  `has_any_role(['staff','admin','super_admin'])` via RPC.
- `lib/auth/session.ts` resolves the primary role from the shared
  `user_roles` table (highest privilege wins; falls back to `staff` while the
  shared signup trigger is still provisioning).
- Roles: `super_admin` > `admin` > `staff` (same as the bookstore).

## i18n

- `lib/i18n/` (ported from the bookstore): `I18nProvider` + `useT()` hook,
  language persisted in the `lang` cookie and `localStorage`, default `zh`.
- Server components read the `lang` cookie and pick strings from
  `lib/i18n/translations.ts`; client components use `useT()`.
- `POST /api/lang` flips the cookie for server-rendered pages.

## Layout

- `components/layout/app-shell.tsx`: sidebar (logo, user identity, nav),
  header, content. Nav items are bilingual in `lib/app-config.ts`.
- Brand tokens in `tailwind.config.ts` under the `cocm` key (paper `#faf7f0`,
  deep blue `#2d2f92`, red `#e5444c`).

## Domain (so far)

- `meals`: published meal events (`meal_date`, `signup_deadline`,
  `price_per_person`, `status`).
- `meal_signups`: one row per member per meal (`guest_count`, `status`),
  unique `(meal_id, user_id)`.
- RLS: everyone reads meals; members manage only their own signups; staff+
  manage meals and see all signups.
