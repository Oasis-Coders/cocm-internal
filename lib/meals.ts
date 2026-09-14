export type MealType = 'breakfast' | 'lunch' | 'dinner';

export const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

export type MealDay = {
  meal_date: string;
  breakfast_available: boolean;
  lunch_available: boolean;
  dinner_available: boolean;
  note: string | null;
};

export type MealSettings = {
  breakfast_price: number;
  lunch_price: number;
  dinner_price: number;
  currency: string;
  transfer_info: string;
};

export type MealSignup = {
  meal_date: string;
  meal_type: MealType;
  price: number;
};

export const defaultMealSettings: MealSettings = {
  breakfast_price: 0,
  lunch_price: 0,
  dinner_price: 0,
  currency: 'GBP',
  transfer_info: '',
};

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
