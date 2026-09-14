# Product Scope

## In scope (scaffold)

- Sign-in / sign-up with Supabase Auth, shared account with the Bookstore app
- Role-based access (`staff` / `admin` / `super_admin`)
- Bilingual (中文/EN) shell: dashboard, profile, admin
- User management: list members, grant/revoke roles (super_admin)
- `meals` + `meal_signups` tables with RLS

## Next: meal signup (pending product decisions)

- Staff publishes meals (manual or weekly auto-generated)
- Members sign up, optionally with guest count
- Signup deadline locks the list; final headcount shown
- Month-end settlement: per meal, headcount × price; totals + export

## Open product questions

1. Pricing: fixed per-person price? How much? Who gets paid at month end?
2. Guests: can one account sign up family/friends (N seats)?
3. Cadence: fixed weekly meal or ad-hoc creation?
4. Collection: stats + calculation only (offline payment), or online payment?

## Explicitly out of scope for now

- Camp/event/check-in/inventory/task features (removed with the Camp App)
- Online payments (until Q4 is answered)
