'use server';

import { revalidatePath } from 'next/cache';

import { getSession, type SessionInfo } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  dinerIdentities,
  isMealAvailable,
  priceForIdentity,
  type DinerIdentity,
  type MealDay,
  type MealSettings,
  type MealType,
} from '@/lib/meals';

const validMealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

type ServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type DinerRow = {
  id: string;
  name: string;
  identity: string;
  is_active: boolean;
  user_id: string | null;
};

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Normalize a typed guest name: trim and collapse inner whitespace. */
function normalizeGuestName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 40);
}

type BookCoreInput = {
  supabase: ServerClient;
  session: SessionInfo & { userId: string };
  diner: DinerRow;
  mealDate: string;
  type: MealType;
  headcount: number;
  allergenConfirmed: boolean;
};

/**
 * Shared booking core: availability, duplicate and allergen checks, then the
 * insert with identity-based price snapshot. Assumes inputs are validated.
 */
async function bookMealForDiner(
  input: BookCoreInput
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, session, diner, mealDate, type, headcount, allergenConfirmed } = input;

  if (!diner.is_active) {
    return { ok: false, error: 'invalid-diner' };
  }

  const { data: day } = await supabase
    .from('meal_days')
    .select('meal_date, breakfast_available, lunch_available, dinner_available, is_camp_day')
    .eq('meal_date', mealDate)
    .maybeSingle();

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
    .eq('diner_id', diner.id)
    .eq('meal_date', mealDate)
    .eq('meal_type', type)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'already-signed-up' };
  }

  const { data: settings } = await supabase
    .from('meal_settings')
    .select('price_staff, price_other')
    .eq('id', 1)
    .maybeSingle();

  const unitPrice = priceForIdentity(
    (settings ?? { price_staff: 3, price_other: 5 }) as MealSettings,
    diner.identity as DinerIdentity
  );
  const total = Math.round(unitPrice * headcount * 100) / 100;

  const { error } = await supabase.from('meal_signups').insert({
    diner_id: diner.id,
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

  // Remember this diner for the booker's one-tap "names I've booked" chips.
  // Stored separately from meal_signups so it survives booking cancellation.
  // Auxiliary: never fail the booking over it.
  try {
    await supabase.from('meal_diner_contacts').upsert(
      {
        user_id: session.userId,
        diner_id: diner.id,
        last_booked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,diner_id' }
    );
  } catch {
    // ignore
  }

  revalidatePath('/meals');
  revalidatePath('/meals/stats');
  return { ok: true };
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: 'unavailable' };
  }

  const { data: diner } = await supabase
    .from('meal_diners')
    .select('id, name, identity, is_active, user_id')
    .eq('id', dinerId)
    .maybeSingle();

  if (!diner) {
    return { ok: false, error: 'invalid-diner' };
  }

  return bookMealForDiner({
    supabase,
    session: session as SessionInfo & { userId: string },
    diner: diner as DinerRow,
    mealDate,
    type: mealType as MealType,
    headcount,
    allergenConfirmed,
  });
}

export type SignupGuestMealInput = {
  guestName: string;
  identity: string;
  mealDate: string;
  mealType: string;
  headcount: number;
  allergenConfirmed: boolean;
};

/**
 * Book a meal for a guest by typing their name directly. Reuses the existing
 * roster entry when the name already exists (exact, then case-insensitive
 * match); otherwise creates one attributed to the booker so the name is saved
 * for quick re-booking later. Typed-name bookings always require the allergen
 * confirmation since they are never self-bookings.
 */
export async function signupGuestMeal(
  input: SignupGuestMealInput
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.userId) {
    return { ok: false, error: 'unauthenticated' };
  }

  const { guestName, identity, mealDate, mealType, headcount, allergenConfirmed } = input;
  const name = normalizeGuestName(guestName);

  if (
    !name ||
    !(dinerIdentities as readonly string[]).includes(identity) ||
    !isValidDate(mealDate) ||
    !validMealTypes.includes(mealType as MealType) ||
    !Number.isInteger(headcount) ||
    headcount < 1 ||
    headcount > 20
  ) {
    return { ok: false, error: 'invalid-input' };
  }

  if (!allergenConfirmed) {
    return { ok: false, error: 'allergen-required' };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: 'unavailable' };
  }

  // Reuse an existing active roster entry to avoid duplicates.
  const { data: exactMatch } = await supabase
    .from('meal_diners')
    .select('id, name, identity, is_active, user_id')
    .eq('is_active', true)
    .eq('name', name)
    .maybeSingle();

  let diner = (exactMatch ?? null) as DinerRow | null;

  if (!diner) {
    const { data: fuzzyMatch } = await supabase
      .from('meal_diners')
      .select('id, name, identity, is_active, user_id')
      .eq('is_active', true)
      .ilike('name', name)
      .limit(1)
      .maybeSingle();
    diner = (fuzzyMatch ?? null) as DinerRow | null;
  }

  if (!diner) {
    // New guest: create a roster entry attributed to the booker.
    // RLS (meal_diners_member_insert) allows this for any signed-in member.
    const { data: created, error: insertError } = await supabase
      .from('meal_diners')
      .insert({ name, identity, allergens: '', created_by: session.userId })
      .select('id, name, identity, is_active, user_id')
      .single();
    if (insertError || !created) {
      return { ok: false, error: 'insert-failed' };
    }
    diner = created as DinerRow;
  }

  return bookMealForDiner({
    supabase,
    session: session as SessionInfo & { userId: string },
    diner,
    mealDate,
    type: mealType as MealType,
    headcount,
    allergenConfirmed: true,
  });
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
