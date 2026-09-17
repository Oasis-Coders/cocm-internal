'use server';

import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { monthBounds } from '@/lib/meals';

export type DinerPayment = {
  id: string;
  diner_id: string | null;
  user_id: string | null;
  period: string;
  kind: 'payment' | 'adjustment';
  amount: number;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function sanitizeNote(value: string | null): string | null {
  const note = (value ?? '').trim().slice(0, 200);
  return note ? note : null;
}

async function requireMealAdmin() {
  const session = await getSession();
  if (
    !session.isAuthenticated ||
    !session.userId ||
    (session.role !== 'admin' && session.role !== 'super_admin')
  ) {
    throw new Error('forbidden');
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error('unavailable');
  return { session, supabase };
}

function parseAmount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0 || Math.abs(rounded) > 100000) return null;
  return rounded;
}

/** Outstanding for one diner in a period: signup total minus all credited amounts. */
async function outstandingForDiner(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  dinerId: string,
  period: string
): Promise<number | null> {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const { start, end } = monthBounds(year, month);

  const [{ data: signupRows }, { data: paymentRows }] = await Promise.all([
    supabase
      .from('meal_signups')
      .select('price')
      .eq('diner_id', dinerId)
      .gte('meal_date', start)
      .lt('meal_date', end),
    supabase.from('meal_payments').select('amount').eq('diner_id', dinerId).eq('period', period),
  ]);

  if (!signupRows || !paymentRows) return null;

  const owed = (signupRows as Array<{ price: number | string }>).reduce(
    (sum, r) => sum + (Number(r.price) || 0),
    0
  );
  const credited = (paymentRows as Array<{ amount: number | string }>).reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );
  return Math.round((owed - credited) * 100) / 100;
}

/** Record a payment received from a diner. */
export async function recordDinerPayment(input: {
  dinerId: string;
  period: string;
  amount: number;
  note: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { session, supabase } = await requireMealAdmin();

  const amount = parseAmount(input.amount);
  if (
    !isValidUuid(input.dinerId) ||
    !isValidPeriod(input.period) ||
    amount === null ||
    amount <= 0
  ) {
    return { ok: false, error: 'invalid-input' };
  }

  const { error } = await supabase.from('meal_payments').insert({
    diner_id: input.dinerId,
    period: input.period,
    kind: 'payment',
    amount,
    note: sanitizeNote(input.note),
    recorded_by: session.userId,
  });
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/stats');
  revalidatePath('/meals');
  return { ok: true };
}

/**
 * Record a balance adjustment for a diner.
 * Positive amount reduces what they owe (waiver); negative adds (correction).
 */
export async function adjustDinerBalance(input: {
  dinerId: string;
  period: string;
  amount: number;
  note: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { session, supabase } = await requireMealAdmin();

  const amount = parseAmount(input.amount);
  if (!isValidUuid(input.dinerId) || !isValidPeriod(input.period) || amount === null) {
    return { ok: false, error: 'invalid-input' };
  }

  const { error } = await supabase.from('meal_payments').insert({
    diner_id: input.dinerId,
    period: input.period,
    kind: 'adjustment',
    amount,
    note: sanitizeNote(input.note),
    recorded_by: session.userId,
  });
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/stats');
  revalidatePath('/meals');
  return { ok: true };
}

/** Confirm a diner paid: records a payment exactly equal to the outstanding amount. */
export async function confirmDinerPaid(input: {
  dinerId: string;
  period: string;
  note: string | null;
}): Promise<{ ok: boolean; error?: string; settled?: number }> {
  const { session, supabase } = await requireMealAdmin();

  if (!isValidUuid(input.dinerId) || !isValidPeriod(input.period)) {
    return { ok: false, error: 'invalid-input' };
  }

  const outstanding = await outstandingForDiner(supabase, input.dinerId, input.period);
  if (outstanding === null) return { ok: false, error: 'save-failed' };
  if (outstanding <= 0) return { ok: true, settled: 0 };

  const { error } = await supabase.from('meal_payments').insert({
    diner_id: input.dinerId,
    period: input.period,
    kind: 'payment',
    amount: outstanding,
    note: sanitizeNote(input.note),
    recorded_by: session.userId,
  });
  if (error) return { ok: false, error: 'save-failed' };

  revalidatePath('/meals/stats');
  revalidatePath('/meals');
  return { ok: true, settled: outstanding };
}

/** Delete a mistakenly recorded payment/adjustment entry. */
export async function removeDinerPayment(input: {
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

  revalidatePath('/meals/stats');
  revalidatePath('/meals');
  return { ok: true };
}
