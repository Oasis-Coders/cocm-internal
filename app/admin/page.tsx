import { cookies } from 'next/headers';
import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { translations, type Lang } from '@/lib/i18n/translations';

export default async function AdminPage() {
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].admin;

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/users"
          className="rounded-card border border-cocm-ink/10 bg-white p-5 shadow-card transition hover:border-cocm-ink/25"
        >
          <span className="font-semibold text-cocm-ink">{t.users}</span>
          <span className="mt-1 block text-sm text-cocm-slate">{t.usersDesc}</span>
        </Link>
      </div>
    </AppShell>
  );
}
