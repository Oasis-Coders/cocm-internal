import { cookies } from 'next/headers';
import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { translations, type Lang, resolveLang } from '@/lib/i18n/translations';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminPage() {
  const store = await cookies();
  const lang: Lang = resolveLang(store.get('lang')?.value);
  const t = translations[lang].admin;

  return (
    <AppShell title={t.title} eyebrow={t.eyebrow}>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/users"
          className="card-hover rounded-[20px] border border-cocm-ink/10 bg-white p-6 shadow-card"
        >
          <span className="font-semibold text-cocm-ink">{t.users}</span>
          <span className="mt-1 block text-sm text-cocm-slate">{t.usersDesc}</span>
        </Link>
      </div>
    </AppShell>
  );
}
