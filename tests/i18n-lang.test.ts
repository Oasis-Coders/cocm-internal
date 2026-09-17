import { describe, expect, it } from 'vitest';

import {
  resolveLang,
  nextLang,
  htmlLangAttr,
  langCycle,
  langLabels,
  translations,
} from '@/lib/i18n/translations';

describe('resolveLang', () => {
  it('accepts the three supported languages', () => {
    expect(resolveLang('en')).toBe('en');
    expect(resolveLang('zh')).toBe('zh');
    expect(resolveLang('zh-Hant')).toBe('zh-Hant');
  });

  it('falls back to Simplified Chinese for anything else', () => {
    expect(resolveLang(null)).toBe('zh');
    expect(resolveLang(undefined)).toBe('zh');
    expect(resolveLang('')).toBe('zh');
    expect(resolveLang('fr')).toBe('zh');
  });
});

describe('language cycling', () => {
  it('cycles 简体 → 繁體 → English → 简体', () => {
    expect(langCycle).toEqual(['zh', 'zh-Hant', 'en']);
    expect(nextLang('zh')).toBe('zh-Hant');
    expect(nextLang('zh-Hant')).toBe('en');
    expect(nextLang('en')).toBe('zh');
  });

  it('labels every language in its own script', () => {
    expect(langLabels.zh).toBe('简体中文');
    expect(langLabels['zh-Hant']).toBe('繁體中文');
    expect(langLabels.en).toBe('English');
  });

  it('emits valid html lang attributes', () => {
    expect(htmlLangAttr('zh')).toBe('zh-CN');
    expect(htmlLangAttr('zh-Hant')).toBe('zh-Hant');
    expect(htmlLangAttr('en')).toBe('en');
  });
});

describe('translation dictionaries', () => {
  const newKeys = [
    'identityVolunteer',
    'priceVolunteer',
    'volunteerFree',
    'mealTimesTitle',
    'campMealsTitle',
    'allergensTitle',
    'noAllergens',
    'attendeeList',
    'headcountPeople',
    'markCampDay',
    'unmarkCampDay',
  ] as const;

  it('defines the new meal keys in all three languages', () => {
    for (const lang of ['en', 'zh', 'zh-Hant'] as const) {
      for (const key of newKeys) {
        expect(
          (translations[lang].meals as Record<string, unknown>)[key],
          `${lang}.meals.${key}`
        ).toBeTruthy();
      }
    }
  });

  it('keeps Traditional and Simplified volunteer copy distinct', () => {
    expect(translations['zh-Hant'].meals.identityVolunteer).not.toBe(
      translations.zh.meals.identityVolunteer
    );
  });
});
