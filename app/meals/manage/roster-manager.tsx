'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { addDiner, setDinerActive } from '@/app/meals/manage/actions';
import { dinerIdentities, type DinerIdentity, type MealDiner } from '@/lib/meals';
import type { translations, Lang } from '@/lib/i18n/translations';

type MealsT = (typeof translations)[Lang]['meals'];
type CommonT = (typeof translations)[Lang]['common'];

type Props = {
  diners: MealDiner[];
  t: MealsT;
  tc: CommonT;
  lang: Lang;
  inputClass: string;
};

export function RosterManager({ diners, t, tc, lang, inputClass }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');

  const identityLabel = (identity: DinerIdentity): string => {
    switch (identity) {
      case 'staff': return t.identityStaff;
      case 'staff_family': return t.identityStaffFamily;
      case 'friend': return t.identityFriend;
      case 'camp_mate': return t.identityCampMate;
      default: return t.identityOther;
    }
  };

  const toggleActive = (diner: MealDiner) => {
    startTransition(async () => {
      const res = await setDinerActive(diner.id, !diner.is_active);
      if (res.ok) router.refresh();
    });
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? diners.filter((d) => d.name.toLowerCase().includes(q))
    : diners;
  const activeCount = diners.filter((d) => d.is_active).length;

  return (
    <div id="roster" className="mt-4 scroll-mt-24 rounded-[20px] border border-cocm-ink/10 bg-white p-5 shadow-card md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-cocm-ink">{t.rosterTitle}</h3>
          <p className="mt-1 text-sm text-cocm-slate">{t.rosterDesc}</p>
        </div>
        <span className="rounded-full bg-cocm-blue/[0.08] px-3 py-1 text-xs font-semibold text-cocm-blue">
          {lang === 'zh' ? `${activeCount} 人在用` : `${activeCount} active`}
        </span>
      </div>

      <form action={addDiner} className="mt-4 grid gap-3 rounded-[16px] border border-dashed border-cocm-ink/15 bg-cocm-blue/[0.03] p-4 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-cocm-ink">{t.dinerName}</span>
          <input name="name" type="text" required maxLength={80} placeholder={t.dinerNamePlaceholder} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-cocm-ink">{t.dinerIdentity}</span>
          <select name="identity" defaultValue="staff" className={inputClass}>
            {dinerIdentities.map((id) => (
              <option key={id} value={id}>{identityLabel(id)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-cocm-ink">{t.dinerAllergens}</span>
          <input name="allergens" type="text" maxLength={200} placeholder={t.dinerAllergensPlaceholder} className={inputClass} />
        </label>
        <button
          type="submit"
          className="h-11 rounded-[12px] bg-cocm-red px-5 text-[15px] font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98]"
        >
          {t.addDiner}
        </button>
      </form>

      <div className="mt-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.rosterSearch}
          className={`${inputClass} w-full md:max-w-xs`}
          aria-label={t.rosterSearch}
        />
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-cocm-slate">{t.rosterEmpty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-cocm-ink/[0.06]">
          {visible.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className={`truncate text-[15px] font-semibold ${d.is_active ? 'text-cocm-ink' : 'text-cocm-slate/50 line-through'}`}>
                  {d.name}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-cocm-slate">
                  <span className="rounded-full bg-cocm-ink/[0.06] px-2 py-0.5 font-semibold">
                    {identityLabel(d.identity as DinerIdentity)}
                  </span>
                  {d.allergens ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      ⚠ {d.allergens}
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => toggleActive(d)}
                className={`shrink-0 rounded-[10px] border px-3 py-1.5 text-[13px] font-semibold transition active:scale-[0.97] disabled:opacity-60 ${
                  d.is_active
                    ? 'border-cocm-ink/15 text-cocm-slate hover:border-cocm-ink/30'
                    : 'border-cocm-blue bg-cocm-blue text-white'
                }`}
              >
                {d.is_active ? t.deactivate : t.activate}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-cocm-slate">{t.rosterInactiveHint}</p>
    </div>
  );
}
