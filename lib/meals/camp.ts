import { todayIso, type MealType } from '@/lib/meals';

export type CampMealDetail = {
  meal_type: MealType;
  /** Clock time HH:MM from meal_settings. */
  time: string;
  headcount: number;
  diners: Array<{ name: string; headcount: number; allergens: string | null }>;
};

export type CampDayOverview = {
  meal_date: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  meals: CampMealDetail[];
  /** Unique diner names across the day's meals. */
  totalDiners: number;
  totalHeadcount: number;
  /** Deduplicated (name, allergen) pairs with non-empty allergen notes. */
  allergens: Array<{ name: string; allergen: string }>;
};

type SupabaseLike = {
  from: (table: string) => any;
};

type MealSettingsLike = {
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Upcoming camp days with per-meal headcount and allergen notes.
 * Callers must ensure the viewer is an admin before invoking.
 */
export async function getCampOverview(
  supabase: SupabaseLike,
  settings: MealSettingsLike,
  opts?: { from?: string; limit?: number }
): Promise<CampDayOverview[]> {
  const from = opts?.from ?? todayIso();
  const limit = opts?.limit ?? 31;

  const { data: dayRows } = await supabase
    .from('meal_days')
    .select('meal_date, breakfast_available, lunch_available, dinner_available')
    .eq('is_camp_day', true)
    .gte('meal_date', from)
    .order('meal_date', { ascending: true })
    .limit(limit);
  const days = (dayRows ?? []) as Array<{
    meal_date: string;
    breakfast_available: boolean;
    lunch_available: boolean;
    dinner_available: boolean;
  }>;
  if (days.length === 0) return [];

  const dates = days.map((d) => d.meal_date);
  const { data: signupRows } = await supabase
    .from('meal_signups')
    .select('meal_date, meal_type, display_name, headcount, diner_id')
    .in('meal_date', dates);
  const signups = (signupRows ?? []) as Array<{
    meal_date: string;
    meal_type: MealType;
    display_name: string | null;
    headcount: number | null;
    diner_id: string | null;
  }>;

  const dinerIds = [...new Set(signups.map((s) => s.diner_id).filter(Boolean))] as string[];
  let allergenByDiner = new Map<string, string>();
  if (dinerIds.length > 0) {
    const { data: dinerRows } = await supabase
      .from('meal_diners')
      .select('id, allergens')
      .in('id', dinerIds);
    allergenByDiner = new Map(
      ((dinerRows ?? []) as Array<{ id: string; allergens: string | null }>).map((d) => [
        d.id,
        (d.allergens ?? '').trim(),
      ])
    );
  }

  const timeFor = (mt: MealType) =>
    mt === 'breakfast'
      ? settings.breakfast_time
      : mt === 'lunch'
        ? settings.lunch_time
        : settings.dinner_time;

  return days.map((day) => {
    const daySignups = signups.filter((s) => s.meal_date === day.meal_date);
    const meals: CampMealDetail[] = MEAL_ORDER.filter((mt) =>
      mt === 'breakfast'
        ? day.breakfast_available
        : mt === 'lunch'
          ? day.lunch_available
          : day.dinner_available
    ).map((mt) => {
      const forMeal = daySignups.filter((s) => s.meal_type === mt);
      const diners = forMeal.map((s) => ({
        name: s.display_name ?? '—',
        headcount: Number(s.headcount) || 1,
        allergens: s.diner_id ? allergenByDiner.get(s.diner_id) || null : null,
      }));
      return {
        meal_type: mt,
        time: timeFor(mt),
        headcount: diners.reduce((sum, d) => sum + d.headcount, 0),
        diners,
      };
    });

    const seen = new Set<string>();
    const allergens: Array<{ name: string; allergen: string }> = [];
    for (const m of meals) {
      for (const d of m.diners) {
        const note = (d.allergens ?? '').trim();
        if (!note) continue;
        const key = `${d.name}::${note}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allergens.push({ name: d.name, allergen: note });
      }
    }

    const uniqueNames = new Set(meals.flatMap((m) => m.diners.map((d) => d.name)));
    return {
      meal_date: day.meal_date,
      breakfast: day.breakfast_available,
      lunch: day.lunch_available,
      dinner: day.dinner_available,
      meals,
      totalDiners: uniqueNames.size,
      totalHeadcount: meals.reduce((sum, m) => sum + m.headcount, 0),
      allergens,
    };
  });
}
