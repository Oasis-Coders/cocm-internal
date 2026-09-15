'use server';

import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  isMealAvailable,
  priceForIdentity,
  type DinerIdentity,
  type MealDay,
  type MealSettings,
  type MealType,
} from '@/lib/meals';

const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type SignupMealInput = {
  dinerId: string;
  mealDate: string;
  mealType: string;
  headcount: number;
  allergenConfirmed: boolean;
};

/**
 * Book a meal for someone on the roster (yourself or a guest).
 * Price is snapshotted from identity-based pricing at signup time.
 * Adding extra people (headcount > 1) requires confirming allergens were
 * checked with them.
 */
export async function signupMeal(
  input: SignupMealInput
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.userId) {
    return { ok: false, error: 'unauthenticated' };
  }

  const { dinerId, mealDate, mealType, headcount, allergenConfirmed } = input;

  if (
    !isValidUuid(dinerId) ||
    !isValidDate(mealDate) ||
    !validMealTypes.includes(mealType as MealType) ||
    !Number.isInteger(headcount) ||
    headcount < 1 ||
    headcount > 20
  ) {
    return { ok: false, error: 'invalid-input' };
  }

  if (headcount > 1 && !allergenConfirmed) {
    return { ok: false, error: 'allergen-required' };
  }

  const type = mealType as MealType;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: 'unavailable' };
  }

  const [{ data: diner }, { data: day }, { data: settings }] = await Promise.all([
    supabase
      .from('meal_diners')
      .select('id, name, identity, is_active, user_id')
      .eq('id', dinerId)
      .maybeSingle(),
    supabase
      .from('meal_days')
      .select('meal_date, breakfast_available, lunch_available, dinner_available, is_camp_day')
      .eq('meal_date', mealDate)
      .maybeSingle(),
    supabase.from('meal_settings').select('price_staff, price_other').eq('id', 1).maybeSingle(),
  ]);

  if (!diner || !diner.is_active) {
    return { ok: false, error: 'invalid-diner' };
  }
  if (!day || !isMealAvailable(day as MealDay, type)) {
    return { ok: false, error: 'not-available' };
  }
  // Booking for another user's linked diner also needs the allergen promise.
  if (diner.user_id && diner.user_id !== session.userId && !allergenConfirmed) {
    return { ok: false, error: 'allergen-required' };
  }

  const { data: existing } = await supabase
    .from('meal_signups')
    .select('id')
    .eq('diner_id', dinerId)
    .eq('meal_date', mealDate)
    .eq('meal_type', type)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'already-signed-up' };
  }

  const unitPrice = priceForIdentity(
    (settings ?? { price_staff: 3, price_other: 5 }) as MealSettings,
    diner.identity as DinerIdentity
  );
  const total = Math.round(unitPrice * headcount * 100) / 100;

  const { error } = await supabase.from('meal_signups').insert({
    diner_id: dinerId,
    display_name: diner.name,
    identity: diner.identity,
    headcount,
    meal_date: mealDate,
    meal_type: type,
    price: total,
    allergen_confirmed: !!allergenConfirmed,
    booked_by: session.userId,
    user_id: session.userId,
  });

  if (error) {
    // Unique-violation race: treat as already signed up.
    if (error.code === '23505') return { ok: false, error: 'already-signed-up' };
    return { ok: false, error: 'insert-failed' };
  }

  revalidatePath('/meals');
  revalidatePath('/meals/stats');
  return { ok: true };
}

/** Cancel a booking you made (or an admin cancelling anything). */
export async function cancelMealSignup(
  signupId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.userId) {
    return { ok: false, error: 'unauthenticated' };
  }
  if (!isValidUuid(signupId)) {
    return { ok: false, error: 'invalid-input' };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: 'unavailable' };
  }

  const isAdmin = session.role === 'admin' || session.role === 'super_admin';

  const { data: row } = await supabase
    .from('meal_signups')
    .select('id, booked_by, user_id')
    .eq('id', signupId)
    .maybeSingle();

  if (!row) return { ok: false, error: 'not-found' };
  if (!isAdmin && row.booked_by !== session.userId && row.user_id !== session.userId) {
    return { ok: false, error: 'forbidden' };
  }

  const { error } = await supabase.from('meal_signups').delete().eq('id', signupId);
  if (error) return { ok: false, error: 'delete-failed' };

  revalidatePath('/meals');
  revalidatePath('/meals/stats');
  return { ok: true };
}
