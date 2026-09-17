'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type MealType } from '@/lib/meals';

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

  const priceStaff = parsePrice(formData.get('price_staff'));
  const priceOther = parsePrice(formData.get('price_other'));
  const priceVolunteer = parsePrice(formData.get('price_volunteer'));

  if (priceStaff === null || priceOther === null || priceVolunteer === null) {
    redirect('/meals/manage?error=invalid-price');
  }

  await supabase
    .from('meal_settings')
    .update({
      price_staff: priceStaff,
      price_other: priceOther,
      price_volunteer: priceVolunteer,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  redirect('/meals/manage?saved=1');
}

function parseMealTime(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const v = String(value).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return null;
  return v;
}

export async function updateMealTimes(formData: FormData) {
  const { session, supabase } = await requireMealAdmin();

  const breakfastTime = parseMealTime(formData.get('breakfast_time'));
  const lunchTime = parseMealTime(formData.get('lunch_time'));
  const dinnerTime = parseMealTime(formData.get('dinner_time'));

  if (!breakfastTime || !lunchTime || !dinnerTime) {
    redirect('/meals/manage?error=invalid-time');
  }

  await supabase
    .from('meal_settings')
    .update({
      breakfast_time: breakfastTime,
      lunch_time: lunchTime,
      dinner_time: dinnerTime,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  revalidatePath('/meals/manage');
  revalidatePath('/meals/stats');
  revalidatePath('/dashboard');
  redirect('/meals/manage?saved=1');
}

/** Mark a date as a camp day (upserts a meal_days row; keeps existing meal flags). */
export async function markCampDay(date: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireMealAdmin();
  if (!isValidDate(date)) return { ok: false, error: 'invalid-date' };

  const { data: existing } = await supabase
    .from('meal_days')
    .select('meal_date, breakfast_available, lunch_available, dinner_available, note')
    .eq('meal_date', date)
    .maybeSingle();

  const row = existing as {
    meal_date: string;
    breakfast_available: boolean;
    lunch_available: boolean;
    dinner_available: boolean;
    note: string | null;
  } | null;

  // Marking a date as a camp day must never change meal availability:
  // a fresh row is created with all meals off, an existing row keeps its
  // availability untouched. Admins enable meals via meal-date management.
  const { error } = await supabase.from('meal_days').upsert(
    {
      meal_date: date,
      breakfast_available: row?.breakfast_available ?? false,
      lunch_available: row?.lunch_available ?? false,
      dinner_available: row?.dinner_available ?? false,
      is_camp_day: true,
      note: row?.note ?? null,
    },
    { onConflict: 'meal_date' }
  );
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals/stats');
  revalidatePath('/dashboard');
  return { ok: true };
}

/** Remove the camp-day mark from a date (the meal day itself stays). */
export async function unmarkCampDay(date: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireMealAdmin();
  if (!isValidDate(date)) return { ok: false, error: 'invalid-date' };

  const { error } = await supabase
    .from('meal_days')
    .update({ is_camp_day: false })
    .eq('meal_date', date);
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals/stats');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function updateTransferInfo(formData: FormData) {
  const { session, supabase } = await requireMealAdmin();

  const transferInfo = String(formData.get('transferInfo') ?? '')
    .trim()
    .slice(0, 4000);

  await supabase
    .from('meal_settings')
    .update({
      transfer_info: transferInfo,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

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

  const note =
    String(formData.get('note') ?? '')
      .trim()
      .slice(0, 200) || null;

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

// ── Client-component friendly actions (no redirects) ──

export type MealDayInput = {
  date: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  note: string | null;
};

function sanitizeNote(value: string | null): string | null {
  const note = (value ?? '').trim().slice(0, 200);
  return note ? note : null;
}

/** Iterate YYYY-MM-DD strings from start to end (inclusive), capped at 366 days. */
function eachDateInRange(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const dates: string[] = [];
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  while (cur <= last && dates.length < 366) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/** Create or update a single meal day (called from the calendar editor). */
export async function saveMealDay(input: MealDayInput): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireMealAdmin();

  if (!isValidDate(input.date)) return { ok: false, error: 'invalid-date' };

  const { error } = await supabase.from('meal_days').upsert(
    {
      meal_date: input.date,
      breakfast_available: !!input.breakfast,
      lunch_available: !!input.lunch,
      dinner_available: !!input.dinner,
      // is_camp_day is intentionally untouched here: camp days are managed
      // from the camp meal overview, not from date management.
      note: sanitizeNote(input.note),
    },
    { onConflict: 'meal_date' }
  );

  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true };
}

/** Delete a single meal day (signups cascade). */
export async function removeMealDay(date: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireMealAdmin();

  if (!isValidDate(date)) return { ok: false, error: 'invalid-date' };

  const { error } = await supabase.from('meal_days').delete().eq('meal_date', date);
  if (error) return { ok: false, error: 'delete-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true };
}

/**
 * Apply meal availability to every day in [start, end].
 * Existing days keep their notes; missing days are created.
 */
export async function saveMealDayRange(input: {
  start: string;
  end: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const { supabase } = await requireMealAdmin();

  const lo = input.start <= input.end ? input.start : input.end;
  const hi = input.start <= input.end ? input.end : input.start;
  if (!isValidDate(lo) || !isValidDate(hi)) return { ok: false, error: 'invalid-date' };

  const dates = eachDateInRange(lo, hi);
  if (dates.length === 0) return { ok: false, error: 'invalid-date' };

  const { data: existing } = await supabase
    .from('meal_days')
    .select('meal_date, note')
    .gte('meal_date', lo)
    .lte('meal_date', hi);
  const noteByDate = new Map(
    ((existing ?? []) as Array<{ meal_date: string; note: string | null }>).map((r) => [
      r.meal_date,
      r.note,
    ])
  );

  const rows = dates.map((meal_date) => ({
    meal_date,
    breakfast_available: !!input.breakfast,
    lunch_available: !!input.lunch,
    dinner_available: !!input.dinner,
    // is_camp_day is intentionally untouched here (see saveMealDay).
    note: noteByDate.get(meal_date) ?? null,
  }));

  const { error } = await supabase.from('meal_days').upsert(rows, { onConflict: 'meal_date' });
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true, count: dates.length };
}

/** Delete every meal day in [start, end] (signups cascade). */
export async function removeMealDayRange(input: {
  start: string;
  end: string;
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const { supabase } = await requireMealAdmin();

  const lo = input.start <= input.end ? input.start : input.end;
  const hi = input.start <= input.end ? input.end : input.start;
  if (!isValidDate(lo) || !isValidDate(hi)) return { ok: false, error: 'invalid-date' };

  const { error, count } = await supabase
    .from('meal_days')
    .delete({ count: 'exact' })
    .gte('meal_date', lo)
    .lte('meal_date', hi);
  if (error) return { ok: false, error: 'delete-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true, count: count ?? 0 };
}

// ── Diner roster ──

const validIdentities = ['staff', 'staff_family', 'friend', 'camp_mate', 'other'] as const;

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeName(value: FormDataEntryValue | string | null): string | null {
  const name = String(value ?? '')
    .trim()
    .slice(0, 80)
    .replace(/\s+/g, ' ');
  return name ? name : null;
}

/** Add a person to the diner roster. */
export async function addDiner(formData: FormData) {
  const { session, supabase } = await requireMealAdmin();

  const name = sanitizeName(formData.get('name'));
  const identity = String(formData.get('identity') ?? 'other');
  const allergens = String(formData.get('allergens') ?? '')
    .trim()
    .slice(0, 200);

  if (!name || !(validIdentities as readonly string[]).includes(identity)) {
    redirect('/meals/manage?error=invalid-diner');
  }

  await supabase.from('meal_diners').insert({
    name,
    identity,
    allergens,
    created_by: session.userId,
  });

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  redirect('/meals/manage?saved=1#roster');
}

/** Activate / deactivate a roster entry (deactivated names hide from the dropdown). */
export async function setDinerActive(dinerId: string, active: boolean) {
  const { supabase } = await requireMealAdmin();

  if (!isValidUuid(dinerId)) return { ok: false as const };

  const { error } = await supabase
    .from('meal_diners')
    .update({ is_active: active })
    .eq('id', dinerId);
  if (error) return { ok: false as const };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true as const };
}
