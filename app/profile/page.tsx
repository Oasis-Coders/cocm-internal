import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { AccountSettings } from '@/components/profile/account-settings';
import { translations, type Lang } from '@/lib/i18n/translations';

type ProfilePageProps = {
  searchParams: Promise<{
    profile?: string;
    credentials?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].profile;

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      <AccountSettings searchParams={params} />
    </AppShell>
  );
}
