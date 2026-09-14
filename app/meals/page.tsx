import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/layout/empty-state';
import { translations, type Lang } from '@/lib/i18n/translations';

export default async function MealsPage() {
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].meals;

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      <EmptyState title={t.comingTitle} description={t.comingDesc} />
    </AppShell>
  );
}
