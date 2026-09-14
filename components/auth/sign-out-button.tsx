'use client';

import { signOut } from '@/app/auth/sign-out-action';
import { useT } from '@/lib/i18n/use-t';

export function SignOutButton() {
  const { t } = useT();

  return (
    <form action={signOut} className="w-full">
      <button
        type="submit"
        className="flex w-full items-center justify-between rounded-xl border border-cocm-ink/10 bg-cocm-sand/30 px-4 py-3 text-left transition-all hover:border-cocm-ink/20 hover:bg-cocm-sand/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-slate/30"
      >
        <span>
          <span className="block text-sm font-semibold text-cocm-ink">{t.common.signOut}</span>
          <span className="mt-0.5 block text-xs text-cocm-slate">{t.common.signOutHint}</span>
        </span>
        <span className="rounded-[10px] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cocm-slate shadow-sm">
          {t.common.exit}
        </span>
      </button>
    </form>
  );
}
