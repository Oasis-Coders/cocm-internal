-- Allow any authenticated member to add a roster diner when booking for a guest
-- by typing a name directly. They may only create rows attributed to themselves;
-- updates/deletes stay admin-only via meal_diners_admin_write.
create policy meal_diners_member_insert
  on public.meal_diners
  for insert
  to authenticated
  with check (created_by = auth.uid());
