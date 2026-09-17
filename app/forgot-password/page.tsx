import Link from 'next/link';
import { cookies, headers } from 'next/headers';
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
  'mt-2 h-11 w-full rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-4 text-[15px] text-cocm-ink outline-none transition placeholder:text-cocm-ink/40 hover:border-cocm-ink/25 focus:border-cocm-blue focus:ring-2 focus:ring-cocm-blue/20';

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const session = await getSession();

  if (session.isAuthenticated) {
    redirect('/dashboard');
  }

  const store = await cookies();
  const lang: Lang = resolveLang(store.get('lang')?.value);
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
    <AuthShell lang={lang} title={t.forgotPasswordTitle} subtitle={t.forgotPasswordDesc}>
      {message ? (
        <div
          className={`mb-4 rounded-[12px] border p-4 text-sm ${
            message.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-cocm-red/20 bg-cocm-red-light/60 text-cocm-ink'
          }`}
          role="alert"
        >
          {message.text}
        </div>
      ) : null}

      {supabaseReady && !params.sent ? (
        <form action={requestPasswordReset} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-[13px] font-semibold tracking-[0.01em] text-cocm-ink"
            >
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
          </div>
          <button
            type="submit"
            className="h-11 w-full rounded-[12px] bg-cocm-blue px-6 text-[15px] font-semibold text-white transition-all hover:bg-[#3f43a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-blue/40 active:scale-[0.99]"
          >
            {t.sendResetLink}
          </button>
        </form>
      ) : null}

      <p className="mt-6 text-center text-sm text-cocm-slate">
        <Link
          href="/sign-in"
          className="font-semibold text-cocm-blue underline-offset-2 hover:underline"
        >
          {t.backToSignIn}
        </Link>
      </p>

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
