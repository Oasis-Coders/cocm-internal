import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { translations, type Lang } from '@/lib/i18n/translations';

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
  'mt-3 w-full rounded-card border-[1.5px] border-cocm-ink/15 bg-white px-4 py-3 text-base text-cocm-ink outline-none transition placeholder:text-cocm-ink/40 focus:border-cocm-slate focus:ring-2 focus:ring-cocm-slate/20';

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const session = await getSession();

  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
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
    <main className="min-h-screen bg-[linear-gradient(180deg,_#e4e5fb_0%,_#faf7f0_45%,_#f5efdc_100%)] px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-panel bg-white p-8 shadow-panel">
        <div className="flex items-center gap-4">
          <Image
            src="/cocm-logo.png"
            alt="COCM"
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
            priority
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cocm-slate">
              {t.resetPasswordEyebrow}
            </p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-cocm-ink">
              {t.resetPasswordTitle}
            </h1>
          </div>
        </div>

        {!linkValid ? (
          <>
            <p className="mt-4 max-w-2xl text-cocm-slate">{t.resetLinkInvalid}</p>
            <p className="mt-6 text-sm text-cocm-slate">
              <Link
                href="/forgot-password"
                className="font-semibold text-cocm-red underline underline-offset-2"
              >
                {t.requestNewLink}
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 max-w-2xl text-cocm-slate">{t.resetPasswordDesc}</p>

            {message ? (
              <div className="border-cocm-red-light bg-cocm-red-light mt-6 rounded-xl border p-4 text-sm text-cocm-ink">
                {message.text}
              </div>
            ) : null}

            <form
              action={setNewPassword}
              className="border-cocm-ink/8 mt-8 rounded-card border bg-white p-6 shadow-card"
            >
              <label htmlFor="password" className="block text-sm font-semibold text-cocm-ink">
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
              <button
                type="submit"
                className="mt-6 rounded-xl bg-cocm-red px-6 py-3 font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-red/40"
              >
                {t.resetPasswordCta}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
