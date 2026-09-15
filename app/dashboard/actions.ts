'use server';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isMealAvailable, mealTypes, type MealType } from '@/lib/meals';

export type DayHeadcount = {
  ok: boolean;
  date: string;
  /** null = no meal day scheduled for this date */
  available: MealType[] | null;
  counts: Record<MealType, number>;
  total: number;
  error?: string;
};

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Admin-only: headcount of meal signups for a single date. */
export async function getMealDayHeadcount(date: string): Promise<DayHeadcount> {
  const session = await getSession();
  if (!session.isAuthenticated || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return {
      ok: false,
      date,
      available: null,
      counts: { breakfast: 0, lunch: 0, dinner: 0 },
      total: 0,
      error: 'forbidden',
    };
  }
  if (!isValidDate(date)) {
    return {
      ok: false,
      date,
      available: null,
      counts: { breakfast: 0, lunch: 0, dinner: 0 },
      total: 0,
      error: 'invalid-input',
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      date,
      available: null,
      counts: { breakfast: 0, lunch: 0, dinner: 0 },
      total: 0,
      error: 'unavailable',
    };
  }

  try {
    const [{ data: day }, { data: signups }] = await Promise.all([
      supabase.from('meal_days').select('*').eq('meal_date', date).maybeSingle(),
      supabase.from('meal_signups').select('meal_type, headcount').eq('meal_date', date),
    ]);

    if (!day) {
      return {
        ok: true,
        date,
        available: null,
        counts: { breakfast: 0, lunch: 0, dinner: 0 },
        total: 0,
      };
    }

    const available = mealTypes.filter((t) => isMealAvailable(day, t));
    const counts: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const row of signups ?? []) {
      const t = row.meal_type as MealType;
      if (t in counts) counts[t] += Number(row.headcount) || 1;
    }

    return {
      ok: true,
      date,
      available,
      counts,
      total: counts.breakfast + counts.lunch + counts.dinner,
    };
  } catch {
    return {
      ok: false,
      date,
      available: null,
      counts: { breakfast: 0, lunch: 0, dinner: 0 },
      total: 0,
      error: 'unavailable',
    };
  }
}
