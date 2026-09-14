import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/auth/auth-card';
import { getSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { sanitizeRedirectTo } from '@/lib/auth/auth-utils';
import { translations, type Lang } from '@/lib/i18n/translations';

type SignInPageProps = {
  searchParams: Promise<{
    redirectTo?: string;
    created?: string;
    confirmation?: string;
    error?: string;
  }>;
};

async function requestPasswordSignIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const redirectTo = sanitizeRedirectTo(String(formData.get('redirectTo') ?? '/dashboard'));

  if (!email || !password) {
    redirect(`/sign-in?error=missing-fields&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`/sign-in?error=supabase-unavailable&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/sign-in?error=invalid-credentials&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  redirect(redirectTo);
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectTo(params.redirectTo);
  const supabaseReady = hasSupabaseEnv();
  const session = await getSession();

  if (session.isAuthenticated) {
    redirect(redirectTo);
  }

  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].auth;

  if (!supabaseReady) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_#e4e5fb_0%,_#faf7f0_45%,_#f5efdc_100%)] px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-panel bg-white p-8 shadow-card">
          <p className="text-xs uppercase tracking-[0.35em] text-cocm-slate">{t.signInEyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl text-cocm-ink">{t.signInTitle}</h1>
          <p className="mt-4 max-w-2xl text-cocm-slate">{t.supabaseUnavailable}</p>
          <p className="mt-2 max-w-2xl text-sm text-cocm-slate">{t.configureHint}</p>
        </div>
      </main>
    );
  }

  const message = params.created
    ? params.confirmation
      ? t.confirmEmail
      : t.accountCreated
    : params.error === 'missing-fields'
      ? t.missingFields
      : params.error
        ? t.invalidCredentials
        : undefined;

  return (
    <AuthCard
      mode="sign-in"
      action={requestPasswordSignIn}
      redirectTo={redirectTo}
      status={message ? (params.created ? 'success' : 'error') : undefined}
      message={message}
    />
  );
}
