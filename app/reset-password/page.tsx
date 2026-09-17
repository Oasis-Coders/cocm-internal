import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import {
  translations,
  type Lang,
  resolveLang,
  nextLang,
  langLabels,
} from '@/lib/i18n/translations';

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

async function setNewPassword(formData: FormData) {
  'use server';

  const password = String(formData.get('password') ?? '');

  if (!password || password.length < 6) {
    redirect('/reset-password?error=too-short');
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect('/reset-password?error=supabase-unavailable');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/reset-password?error=invalid-link');
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect('/reset-password?error=reset-failed');
  }

  await supabase.auth.signOut();
  redirect('/sign-in?reset=1');
}

const inputClassName =
  'mt-2 h-11 w-full rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-4 text-[15px] text-cocm-ink outline-none transition placeholder:text-cocm-ink/40 hover:border-cocm-ink/25 focus:border-cocm-blue focus:ring-2 focus:ring-cocm-blue/20';

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const session = await getSession();

  const store = await cookies();
  const lang: Lang = resolveLang(store.get('lang')?.value);
  const t = translations[lang].auth;
  const supabaseReady = hasSupabaseEnv();

  const linkValid = session.isAuthenticated && supabaseReady;

  const message =
    params.error === 'too-short'
      ? { tone: 'error' as const, text: t.passwordTooShort }
      : params.error === 'reset-failed'
        ? { tone: 'error' as const, text: t.resetFailed }
        : params.error === 'supabase-unavailable'
          ? { tone: 'error' as const, text: t.supabaseUnavailable }
          : null;

  return (
    <AuthShell lang={lang} title={t.resetPasswordTitle} subtitle={t.resetPasswordDesc}>
      {!linkValid ? (
        <>
          <p className="text-sm leading-relaxed text-cocm-slate">{t.resetLinkInvalid}</p>
          <p className="mt-6 text-center text-sm text-cocm-slate">
            <Link
              href="/forgot-password"
              className="font-semibold text-cocm-blue underline-offset-2 hover:underline"
            >
              {t.requestNewLink}
            </Link>
          </p>
        </>
      ) : (
        <>
          {message ? (
            <div
              className="mb-4 rounded-[12px] border border-cocm-red/20 bg-cocm-red-light/60 p-4 text-sm text-cocm-ink"
              role="alert"
            >
              {message.text}
            </div>
          ) : null}

          <form action={setNewPassword} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-[13px] font-semibold tracking-[0.01em] text-cocm-ink"
              >
                {t.newPassword}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder={t.newPasswordPlaceholder}
                className={inputClassName}
              />
            </div>
            <button
              type="submit"
              className="h-11 w-full rounded-[12px] bg-cocm-blue px-6 text-[15px] font-semibold text-white transition-all hover:bg-[#3f43a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-blue/40 active:scale-[0.99]"
            >
              {t.resetPasswordCta}
            </button>
          </form>
        </>
      )}

      <form action="/api/lang" method="post" className="mt-6 flex justify-center">
        <input type="hidden" name="lang" value={nextLang(lang)} />
        <button
          type="submit"
          className="rounded-full border border-cocm-ink/15 px-4 py-1.5 text-[13px] font-semibold text-cocm-slate transition hover:border-cocm-ink/30 hover:text-cocm-ink"
        >
          {langLabels[nextLang(lang)]}
        </button>
      </form>
    </AuthShell>
  );
}
