'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MealType } from '@/lib/meals';

const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

async function requireMealAdmin() {
  const session = await getSession();
  if (!session.isAuthenticated || (session.role !== 'admin' && session.role !== 'super_admin')) {
    redirect('/meals');
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/meals');
  return { session, supabase };
}

function parsePrice(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return Math.round(n * 100) / 100;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function updateMealPrices(formData: FormData) {
  const { session, supabase } = await requireMealAdmin();

  const breakfast = parsePrice(formData.get('breakfast'));
  const lunch = parsePrice(formData.get('lunch'));
  const dinner = parsePrice(formData.get('dinner'));

  if (breakfast === null || lunch === null || dinner === null) {
    redirect('/meals/manage?error=invalid-price');
  }

  await supabase.from('meal_settings').upsert(
    {
      id: 1,
      breakfast_price: breakfast,
      lunch_price: lunch,
      dinner_price: dinner,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  redirect('/meals/manage?saved=1');
}

export async function updateTransferInfo(formData: FormData) {
  const { session, supabase } = await requireMealAdmin();

  const transferInfo = String(formData.get('transferInfo') ?? '').trim().slice(0, 4000);

  await supabase.from('meal_settings').upsert(
    {
      id: 1,
      transfer_info: transferInfo,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  redirect('/meals/manage?saved=1');
}

export async function addMealDay(formData: FormData) {
  const { supabase } = await requireMealAdmin();

  const date = String(formData.get('date') ?? '').trim();
  if (!isValidDate(date)) {
    redirect('/meals/manage?error=invalid-date');
  }

  const note = String(formData.get('note') ?? '').trim().slice(0, 200) || null;

  await supabase.from('meal_days').upsert(
    {
      meal_date: date,
      breakfast_available: formData.get('breakfast') === 'on',
      lunch_available: formData.get('lunch') === 'on',
      dinner_available: formData.get('dinner') === 'on',
      note,
    },
    { onConflict: 'meal_date' }
  );

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  redirect('/meals/manage?saved=1');
}

export async function toggleMealAvailability(mealDate: string, mealType: string) {
  const { supabase } = await requireMealAdmin();

  if (!isValidDate(mealDate) || !validMealTypes.includes(mealType as MealType)) {
    return;
  }

  const column =
    mealType === 'breakfast'
      ? 'breakfast_available'
      : mealType === 'lunch'
        ? 'lunch_available'
        : 'dinner_available';

  const { data: day } = await supabase
    .from('meal_days')
    .select(column)
    .eq('meal_date', mealDate)
    .maybeSingle();

  if (!day) return;

  await supabase
    .from('meal_days')
    .update({ [column]: !(day as Record<string, boolean>)[column] })
    .eq('meal_date', mealDate);

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
}

export async function deleteMealDay(mealDate: string) {
  const { supabase } = await requireMealAdmin();

  if (!isValidDate(mealDate)) return;

  await supabase.from('meal_days').delete().eq('meal_date', mealDate);

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
}
