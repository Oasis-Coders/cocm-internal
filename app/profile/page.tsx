import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { AccountSettings } from '@/components/profile/account-settings';
import { translations, type Lang, resolveLang } from '@/lib/i18n/translations';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type ProfilePageProps = {
  searchParams: Promise<{
    profile?: string;
    credentials?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const store = await cookies();
  const lang: Lang = resolveLang(store.get('lang')?.value);
  const t = translations[lang].profile;

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      <AccountSettings searchParams={params} />
    </AppShell>
  );
}
