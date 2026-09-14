import Image from 'next/image';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { translations, type Lang } from '@/lib/i18n/translations';

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    sent?: string;
    error?: string;
  }>;
};

async function requestPasswordReset(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    redirect('/forgot-password?error=missing-fields');
  }

  // Use the implicit flow (no PKCE code challenge): the emailed link then
  // carries a self-contained token that /auth/confirm verifies directly, so
  // it works even when clicked on a different device/browser.
  const supabase = await createSupabaseServerClient({ auth: { flowType: 'implicit' } });

  if (!supabase) {
    redirect('/forgot-password?error=supabase-unavailable');
  }

  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? '';
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  // The email link points at /auth/confirm, which verifies the token
  // server-side (no PKCE verifier cookie needed, so the link works even when
  // clicked on a different device than the one that requested it).
  const redirectTo = `${proto}://${host}/auth/confirm`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    redirect('/forgot-password?error=request-failed');
  }

  redirect('/forgot-password?sent=1');
}

const inputClassName =
  'mt-3 w-full rounded-card border-[1.5px] border-cocm-ink/15 bg-white px-4 py-3 text-base text-cocm-ink outline-none transition placeholder:text-cocm-ink/40 focus:border-cocm-slate focus:ring-2 focus:ring-cocm-slate/20';

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const session = await getSession();

  if (session.isAuthenticated) {
    redirect('/dashboard');
  }

  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].auth;
  const supabaseReady = hasSupabaseEnv();

  const message = params.sent
    ? { tone: 'success' as const, text: t.resetLinkSent }
    : params.error === 'missing-fields'
      ? { tone: 'error' as const, text: t.missingFields }
      : params.error === 'request-failed'
        ? { tone: 'error' as const, text: t.resetRequestFailed }
        : params.error === 'invalid-link'
          ? { tone: 'error' as const, text: t.resetLinkInvalid }
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
              {t.forgotPasswordEyebrow}
            </p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-cocm-ink">
              {t.forgotPasswordTitle}
            </h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-cocm-slate">{t.forgotPasswordDesc}</p>

        {message ? (
          <div
            className={`mt-6 rounded-xl border p-4 text-sm ${
              message.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-cocm-red-light bg-cocm-red-light text-cocm-ink'
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {supabaseReady && !params.sent ? (
          <form
            action={requestPasswordReset}
            className="border-cocm-ink/8 mt-8 rounded-card border bg-white p-6 shadow-card"
          >
            <label htmlFor="email" className="block text-sm font-semibold text-cocm-ink">
              {t.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClassName}
            />
            <button
              type="submit"
              className="mt-6 rounded-xl bg-cocm-red px-6 py-3 font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-red/40"
            >
              {t.sendResetLink}
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-sm text-cocm-slate">
          <Link
            href="/sign-in"
            className="font-semibold text-cocm-red underline underline-offset-2"
          >
            {t.backToSignIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
