import { cookies } from 'next/headers';

import { AppShell } from '@/components/layout/app-shell';
import { TicketNewClient } from './ticket-new-client';
import { isTicketAdmin } from '../actions';
import { resolveLang, type Lang } from '@/lib/i18n/translations';
import { ticketStrings } from '../ticket-ui';

const TITLE: Record<Lang, string> = { zh: '新建工单', 'zh-Hant': '新建工單', en: 'New ticket' };

export default async function TicketNewPage() {
  const ok = await isTicketAdmin();
  const store = await cookies();
  const lang = resolveLang(store.get('lang')?.value);
  return (
    <AppShell title={TITLE[lang]} eyebrow="Tickets">
      {ok ? (
        <TicketNewClient lang={lang} />
      ) : (
        <div className="rounded-[16px] border border-cocm-ink/10 bg-white p-8 text-center text-[13px] text-[#5b5f94]">
          {ticketStrings.adminOnly[lang]}
        </div>
      )}
    </AppShell>
  );
}
