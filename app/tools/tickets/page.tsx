import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { TicketsClient } from './tickets-client';
import { isTicketAdmin } from './actions';
import { resolveLang, type Lang } from '@/lib/i18n/translations';
import { ticketStrings } from './ticket-ui';

const TITLE: Record<Lang, string> = { zh: '问题申报', 'zh-Hant': '問題申報', en: 'Issue Reports' };

/** 问题申报：admin+ 可见，agent 自动跟进处理 */
export default async function TicketsPage() {
  const ok = await isTicketAdmin();
  const store = await cookies();
  const lang = resolveLang(store.get('lang')?.value);
  return (
    <AppShell title={TITLE[lang]} eyebrow="Tickets">
      {ok ? (
        <TicketsClient lang={lang} />
      ) : (
        <div className="rounded-[16px] border border-cocm-ink/10 bg-white p-8 text-center text-[13px] text-[#5b5f94]">
          {ticketStrings.adminOnly[lang]}
        </div>
      )}
    </AppShell>
  );
}
