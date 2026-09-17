export type MealType = 'breakfast' | 'lunch' | 'dinner';

export const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

/** Who is eating: staff, staff family, volunteer, friend, camp participant, or other. */
export type DinerIdentity =
  | 'staff'
  | 'staff_family'
  | 'volunteer'
  | 'friend'
  | 'camp_mate'
  | 'other';

export const dinerIdentities: DinerIdentity[] = [
  'staff',
  'staff_family',
  'volunteer',
  'friend',
  'camp_mate',
  'other',
];

/** Staff & staff family pay the staff price; everyone else pays the other price. */
export function isStaffIdentity(identity: DinerIdentity | string | null | undefined): boolean {
  return identity === 'staff' || identity === 'staff_family';
}

/** Volunteers eat free (price_volunteer, defaults to 0). */
export function isVolunteerIdentity(identity: DinerIdentity | string | null | undefined): boolean {
  return identity === 'volunteer';
}

export type MealDiner = {
  id: string;
  name: string;
  identity: DinerIdentity;
  allergens: string;
  is_active: boolean;
  user_id: string | null;
};

export type MealDay = {
  meal_date: string;
  breakfast_available: boolean;
  lunch_available: boolean;
  dinner_available: boolean;
  is_camp_day: boolean;
  note: string | null;
};

export type MealSettings = {
  breakfast_price: number;
  lunch_price: number;
  dinner_price: number;
  /** Per-meal price for staff & staff family. */
  price_staff: number;
  /** Per-meal price for everyone else. */
  price_other: number;
  /** Per-meal price for volunteers (defaults to 0 = free). */
  price_volunteer: number;
  currency: string;
  transfer_info: string;
  /** Camp meal clock times (HH:MM), shown in the camp meal overview. */
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
};

export type MealSignup = {
  id: string;
  meal_date: string;
  meal_type: MealType;
  price: number;
  diner_id: string | null;
  display_name: string | null;
  identity: DinerIdentity | null;
  headcount: number;
  booked_by: string | null;
  user_id: string | null;
};

export const defaultMealSettings: MealSettings = {
  breakfast_price: 0,
  lunch_price: 0,
  dinner_price: 0,
  price_staff: 3,
  price_other: 5,
  price_volunteer: 0,
  currency: 'GBP',
  transfer_info: '',
  breakfast_time: '08:00',
  lunch_time: '12:30',
  dinner_time: '18:00',
};

/** Build a full MealSettings from a DB row (new columns may be missing on old rows). */
export function mealSettingsFromRow(row: Record<string, unknown> | null | undefined): MealSettings {
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);
  return {
    breakfast_price: num(row?.breakfast_price, 0),
    lunch_price: num(row?.lunch_price, 0),
    dinner_price: num(row?.dinner_price, 0),
    price_staff: num(row?.price_staff, 3),
    price_other: num(row?.price_other, 5),
    price_volunteer: num(row?.price_volunteer, 0),
    currency: str(row?.currency, 'GBP'),
    transfer_info: str(row?.transfer_info, ''),
    breakfast_time: str(row?.breakfast_time, '08:00'),
    lunch_time: str(row?.lunch_time, '12:30'),
    dinner_time: str(row?.dinner_time, '18:00'),
  };
}

/** Identity-based price: volunteers eat free, staff & staff family get the staff price. */
export function priceForIdentity(
  settings: MealSettings,
  identity: DinerIdentity | string | null | undefined
): number {
  if (isVolunteerIdentity(identity)) return Number(settings.price_volunteer) || 0;
  return isStaffIdentity(identity)
    ? Number(settings.price_staff) || 0
    : Number(settings.price_other) || 0;
}

export function priceForMeal(settings: MealSettings, mealType: MealType): number {
  if (mealType === 'breakfast') return Number(settings.breakfast_price) || 0;
  if (mealType === 'lunch') return Number(settings.lunch_price) || 0;
  return Number(settings.dinner_price) || 0;
}

export function isMealAvailable(day: MealDay, mealType: MealType): boolean {
  if (mealType === 'breakfast') return day.breakfast_available;
  if (mealType === 'lunch') return day.lunch_available;
  return day.dinner_available;
}

export function formatMoney(amount: number, currency: string): string {
  const value = Number(amount) || 0;
  const symbol = currency === 'GBP' ? '£' : `${currency} `;
  return `${symbol}${value.toFixed(2)}`;
}

/** [start, end) date strings (YYYY-MM-DD) for a calendar month. */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${year}-${pad(month)}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const end = `${next.y}-${pad(next.m)}-01`;
  return { start, end };
}

export function currentYearMonth(now = new Date()): { year: number; month: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Add n days to a YYYY-MM-DD date string. */
export function addDaysIso(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Default availability rule: Monday–Friday lunch is bookable without an
 * explicit meal_days row. Weekends have no default. An explicit admin row
 * always wins, so the admin can still edit any day afterwards.
 */
export function isWeekdayDate(dateStr: string): boolean {
  const dow = new Date(`${dateStr}T12:00:00`).getDay();
  return dow >= 1 && dow <= 5;
}

/** Virtual meal day for dates with no explicit row; null = not bookable by default. */
export function defaultMealDay(dateStr: string): MealDay | null {
  if (!isWeekdayDate(dateStr)) return null;
  return {
    meal_date: dateStr,
    breakfast_available: false,
    lunch_available: true,
    dinner_available: false,
    is_camp_day: false,
    note: null,
  };
}

/** Explicit admin row wins; otherwise fall back to the weekday default. */
export function resolveMealDay(dateStr: string, row: MealDay | null | undefined): MealDay | null {
  return row ?? defaultMealDay(dateStr);
}
