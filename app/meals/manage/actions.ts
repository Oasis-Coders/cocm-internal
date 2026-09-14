'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { monthBounds, type MealType } from '@/lib/meals';

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

  await supabase
    .from('meal_settings')
    .update({
      breakfast_price: breakfast,
      lunch_price: lunch,
      dinner_price: dinner,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  redirect('/meals/manage?saved=1');
}

export async function updateTransferInfo(formData: FormData) {
  const { session, supabase } = await requireMealAdmin();

  const transferInfo = String(formData.get('transferInfo') ?? '').trim().slice(0, 4000);

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
  const noteByDate = new Map(((existing ?? []) as Array<{ meal_date: string; note: string | null }>).map((r) => [r.meal_date, r.note]));

  const rows = dates.map((meal_date) => ({
    meal_date,
    breakfast_available: !!input.breakfast,
    lunch_available: !!input.lunch,
    dinner_available: !!input.dinner,
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

// ── Meal payments: record receipts & adjust balances ──

export type PaymentKind = 'payment' | 'adjustment';

export type MealPaymentInput = {
  userId: string;
  /** 'YYYY-MM' settlement period. */
  period: string;
  kind: PaymentKind;
  /** > 0 for payments; signed (+waiver / −correction) for adjustments. */
  amount: number;
  note: string | null;
};

export type MealPayment = {
  id: string;
  user_id: string;
  period: string;
  kind: PaymentKind;
  amount: number;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
};

function isValidPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseMoney(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0 || Math.abs(rounded) > 100000) return null;
  return rounded;
}

/** Record money received from a member (reduces their outstanding balance). */
export async function recordMealPayment(
  input: MealPaymentInput
): Promise<{ ok: boolean; error?: string }> {
  const { session, supabase } = await requireMealAdmin();

  if (!isValidUuid(input.userId) || !isValidPeriod(input.period)) {
    return { ok: false, error: 'invalid-input' };
  }
  const amount = parseMoney(input.amount);
  if (amount === null || amount <= 0) return { ok: false, error: 'invalid-amount' };

  const { error } = await supabase.from('meal_payments').insert({
    user_id: input.userId,
    period: input.period,
    kind: 'payment',
    amount,
    note: sanitizeNote(input.note),
    recorded_by: session.userId,
  });
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true };
}

/**
 * Manual balance correction. Positive amount = waiver/discount (reduces what
 * they owe); negative amount = undercharge correction (increases what they owe).
 */
export async function adjustMealBalance(
  input: MealPaymentInput
): Promise<{ ok: boolean; error?: string }> {
  const { session, supabase } = await requireMealAdmin();

  if (!isValidUuid(input.userId) || !isValidPeriod(input.period)) {
    return { ok: false, error: 'invalid-input' };
  }
  const amount = parseMoney(input.amount);
  if (amount === null) return { ok: false, error: 'invalid-amount' };

  const { error } = await supabase.from('meal_payments').insert({
    user_id: input.userId,
    period: input.period,
    kind: 'adjustment',
    amount,
    note: sanitizeNote(input.note),
    recorded_by: session.userId,
  });
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true };
}

async function outstandingFor(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  period: string
): Promise<number | null> {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const { start, end } = monthBounds(year, month);

  const [{ data: signupRows }, { data: paymentRows }] = await Promise.all([
    supabase
      .from('meal_signups')
      .select('price')
      .eq('user_id', userId)
      .gte('meal_date', start)
      .lt('meal_date', end),
    supabase.from('meal_payments').select('amount').eq('user_id', userId).eq('period', period),
  ]);

  const owed = ((signupRows ?? []) as Array<{ price: number | string }>).reduce(
    (sum, r) => sum + (Number(r.price) || 0),
    0
  );
  const credited = ((paymentRows ?? []) as Array<{ amount: number | string }>).reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );
  return Math.round((owed - credited) * 100) / 100;
}

/**
 * Settle a member's balance: records a payment exactly equal to the current
 * outstanding amount. Returns the settled amount (0 when nothing was owed).
 */
export async function clearMealBalance(input: {
  userId: string;
  period: string;
  note: string | null;
}): Promise<{ ok: boolean; error?: string; settled?: number }> {
  const { session, supabase } = await requireMealAdmin();

  if (!isValidUuid(input.userId) || !isValidPeriod(input.period)) {
    return { ok: false, error: 'invalid-input' };
  }

  const outstanding = await outstandingFor(supabase, input.userId, input.period);
  if (outstanding === null) return { ok: false, error: 'save-failed' };
  if (outstanding <= 0) return { ok: true, settled: 0 };

  const { error } = await supabase.from('meal_payments').insert({
    user_id: input.userId,
    period: input.period,
    kind: 'payment',
    amount: outstanding,
    note: sanitizeNote(input.note),
    recorded_by: session.userId,
  });
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true, settled: outstanding };
}

/** Delete a mistakenly recorded payment/adjustment entry. */
export async function removeMealPayment(input: {
  paymentId: string;
  period: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireMealAdmin();

  if (!isValidUuid(input.paymentId) || !isValidPeriod(input.period)) {
    return { ok: false, error: 'invalid-input' };
  }

  const { error } = await supabase
    .from('meal_payments')
    .delete()
    .eq('id', input.paymentId)
    .eq('period', input.period);
  if (error) return { ok: false, error: 'delete-failed' };

  revalidatePath('/meals/manage');
  revalidatePath('/meals');
  return { ok: true };
}
