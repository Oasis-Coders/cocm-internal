import { describe, expect, it } from 'vitest';

import { getCampOverview } from '@/lib/meals/camp';

/** Minimal thenable query builder mock for the chained supabase calls. */
function mockSupabase(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: Record<string, unknown> = {};
      const state: {
        eqs: Array<[string, unknown]>;
        gte?: [string, string];
        in?: [string, unknown[]];
        limit?: number;
      } = {
        eqs: [],
      };
      builder.select = () => builder;
      builder.eq = (col: string, val: unknown) => {
        state.eqs.push([col, val]);
        return builder;
      };
      builder.gte = (col: string, val: string) => {
        state.gte = [col, val];
        return builder;
      };
      builder.in = (col: string, vals: unknown[]) => {
        state.in = [col, vals];
        return builder;
      };
      builder.order = () => builder;
      builder.limit = (n: number) => {
        state.limit = n;
        return builder;
      };
      const run = () => {
        let out = rows as Array<Record<string, unknown>>;
        for (const [col, val] of state.eqs) out = out.filter((r) => r[col] === val);
        if (state.gte) {
          const [col, val] = state.gte;
          out = out.filter((r) => String(r[col]) >= val);
        }
        if (state.in) {
          const [col, vals] = state.in;
          out = out.filter((r) => (vals as unknown[]).includes(r[col]));
        }
        if (state.limit !== undefined) out = out.slice(0, state.limit);
        return { data: out };
      };
      // Make the builder awaitable.
      (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        Promise.resolve(run()).then(resolve);
      return builder;
    },
  };
}

const settings = { breakfast_time: '08:00', lunch_time: '12:30', dinner_time: '18:00' };

describe('getCampOverview', () => {
  it('aggregates per-meal headcount, times, diners and deduplicated allergens', async () => {
    const supabase = mockSupabase({
      meal_days: [
        {
          meal_date: '2026-09-20',
          is_camp_day: true,
          breakfast_available: true,
          lunch_available: true,
          dinner_available: false,
        },
        {
          meal_date: '2026-09-21',
          is_camp_day: true,
          breakfast_available: false,
          lunch_available: true,
          dinner_available: true,
        },
      ],
      meal_signups: [
        {
          meal_date: '2026-09-20',
          meal_type: 'lunch',
          display_name: 'Alice',
          headcount: 2,
          diner_id: 'd1',
        },
        {
          meal_date: '2026-09-20',
          meal_type: 'lunch',
          display_name: 'Bob',
          headcount: 1,
          diner_id: 'd2',
        },
        {
          meal_date: '2026-09-20',
          meal_type: 'breakfast',
          display_name: 'Alice',
          headcount: 1,
          diner_id: 'd1',
        },
        // Signed up for two meals: allergen note must appear only once.
        {
          meal_date: '2026-09-20',
          meal_type: 'breakfast',
          display_name: 'Bob',
          headcount: 1,
          diner_id: 'd2',
        },
      ],
      meal_diners: [
        { id: 'd1', allergens: '花生' },
        { id: 'd2', allergens: '' },
      ],
    });

    const days = await getCampOverview(supabase, settings, { from: '2026-09-20' });
    expect(days).toHaveLength(2);

    const first = days[0];
    expect(first.meal_date).toBe('2026-09-20');
    expect(first.meals.map((m) => m.meal_type)).toEqual(['breakfast', 'lunch']);

    const lunch = first.meals.find((m) => m.meal_type === 'lunch')!;
    expect(lunch.time).toBe('12:30');
    expect(lunch.headcount).toBe(3);
    expect(lunch.diners.map((d) => d.name)).toEqual(['Alice', 'Bob']);

    const breakfast = first.meals.find((m) => m.meal_type === 'breakfast')!;
    expect(breakfast.time).toBe('08:00');
    expect(breakfast.headcount).toBe(2);

    expect(first.totalHeadcount).toBe(5);
    expect(first.totalDiners).toBe(2);

    // Alice's peanut note appears once even though she booked two meals.
    expect(first.allergens).toEqual([{ name: 'Alice', allergen: '花生' }]);
  });

  it('returns an empty list when there are no camp days', async () => {
    const supabase = mockSupabase({ meal_days: [], meal_signups: [], meal_diners: [] });
    expect(await getCampOverview(supabase, settings, { from: '2026-09-20' })).toEqual([]);
  });
});
