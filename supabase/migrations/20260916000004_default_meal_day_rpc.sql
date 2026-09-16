-- Materialize the Mon–Fri lunch default as a real meal_days row so the
-- meal_signups.meal_date foreign key holds when booking a virtual default day.
--
-- SECURITY DEFINER: callable by any authenticated user, but it can only ever
-- insert the canonical weekday default (lunch only) — never arbitrary
-- availability. Explicit admin rows always win via ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.ensure_default_meal_day(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXTRACT(ISODOW FROM p_date) BETWEEN 1 AND 5 THEN
    INSERT INTO public.meal_days (
      meal_date, breakfast_available, lunch_available, dinner_available, is_camp_day
    )
    VALUES (p_date, false, true, false, false)
    ON CONFLICT (meal_date) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_meal_day(date) TO authenticated;
REVOKE ALL ON FUNCTION public.ensure_default_meal_day(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_default_meal_day(date) FROM anon;
