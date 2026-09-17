import { describe, expect, it } from 'vitest';

import {
  priceForIdentity,
  mealSettingsFromRow,
  type MealSettings,
  type DinerIdentity,
} from '@/lib/meals';

const base: MealSettings = mealSettingsFromRow({
  price_staff: 3,
  price_other: 5,
  price_volunteer: 0,
});

describe('priceForIdentity', () => {
  it('prices volunteers at £0 by default', () => {
    expect(priceForIdentity(base, 'volunteer')).toBe(0);
  });

  it('prices volunteers at £0 even when the column is missing (old row)', () => {
    const legacy = mealSettingsFromRow({ price_staff: 3, price_other: 5 });
    expect(legacy.price_volunteer).toBe(0);
    expect(priceForIdentity(legacy, 'volunteer')).toBe(0);
  });

  it('honours a configured volunteer price', () => {
    const custom = mealSettingsFromRow({ price_staff: 3, price_other: 5, price_volunteer: 2 });
    expect(priceForIdentity(custom, 'volunteer')).toBe(2);
  });

  it('prices staff and staff_family at the staff rate', () => {
    expect(priceForIdentity(base, 'staff')).toBe(3);
    expect(priceForIdentity(base, 'staff_family')).toBe(3);
  });

  it('prices everyone else at the other rate', () => {
    const identities: DinerIdentity[] = ['friend', 'camp_mate', 'other'];
    for (const id of identities) {
      expect(priceForIdentity(base, id)).toBe(5);
    }
  });
});
