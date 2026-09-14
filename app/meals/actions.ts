'use server';

import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  isMealAvailable,
  priceForMeal,
  type MealDay,
  type MealSettings,
  type MealType,
} from '@/lib/meals';

const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function toggleMealSignup(
  mealDate: string,
  mealType: string
): Promise<{ ok: boolean; signedUp?: boolean; error?: string }> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.userId) {
    return { ok: false, error: 'unauthenticated' };
  }

  if (!isValidDate(mealDate) || !validMealTypes.includes(mealType as MealType)) {
    return { ok: false, error: 'invalid-input' };
  }

  const type = mealType as MealType;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: 'unavailable' };
  }

  const { data: day } = await supabase
    .from('meal_days')
    .select('meal_date, breakfast_available, lunch_available, dinner_available')
    .eq('meal_date', mealDate)
    .maybeSingle();

  if (!day || !isMealAvailable(day as MealDay, type)) {
    return { ok: false, error: 'not-available' };
  }

  const { data: existing } = await supabase
    .from('meal_signups')
    .select('id')
    .eq('user_id', session.userId)
    .eq('meal_date', mealDate)
    .eq('meal_type', type)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('meal_signups').delete().eq('id', existing.id);
    if (error) return { ok: false, error: 'delete-failed' };
    revalidatePath('/meals');
    return { ok: true, signedUp: false };
  }

  const { data: settings } = await supabase
    .from('meal_settings')
    .select('breakfast_price, lunch_price, dinner_price')
    .eq('id', 1)
    .maybeSingle();

  const price = priceForMeal((settings ?? {}) as MealSettings, type);

  const { error } = await supabase.from('meal_signups').insert({
    user_id: session.userId,
    meal_date: mealDate,
    meal_type: type,
    price,
  });

  if (error) return { ok: false, error: 'insert-failed' };

  revalidatePath('/meals');
  return { ok: true, signedUp: true };
}
