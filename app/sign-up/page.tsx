import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/components/auth/auth-card';
import { getSession } from '@/lib/auth/session';
import { buildSignUpMetadata, sanitizeRedirectTo } from '@/lib/auth/auth-utils';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseAdminEnv, hasSupabaseEnv } from '@/lib/supabase/env';
import { translations, type Lang, resolveLang } from '@/lib/i18n/translations';

type SignUpPageProps = {
  searchParams: Promise<{
    redirectTo?: string;
    error?: string;
  }>;
};

async function requestPasswordSignUp(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('displayName') ?? '').trim();
  const redirectTo = sanitizeRedirectTo(String(formData.get('redirectTo') ?? '/dashboard'));

  if (!email || !password || !displayName) {
    redirect(`/sign-up?error=missing-fields&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`/sign-up?error=supabase-unavailable&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const metadata = buildSignUpMetadata(displayName);

  // When the service role key is available, create the account directly so the
  // shared handle_new_user() trigger provisions the profile + role immediately.
  if (hasSupabaseAdminEnv()) {
    const adminSupabase = createSupabaseAdminClient();

    if (!adminSupabase) {
      redirect(`/sign-up?error=admin-unavailable&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error || !data.user) {
      redirect(`/sign-up?error=sign-up-failed&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      redirect(`/sign-in?created=1&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    redirect(redirectTo);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error || !data.user) {
    redirect(`/sign-up?error=sign-up-failed&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  if (data.session) {
    redirect(redirectTo);
  }

  redirect(`/sign-in?created=1&confirmation=1&redirectTo=${encodeURIComponent(redirectTo)}`);
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectTo(params.redirectTo);
  const supabaseReady = hasSupabaseEnv();
  const session = await getSession();

  if (session.isAuthenticated) {
    redirect(redirectTo);
  }

  if (!supabaseReady) {
    redirect('/sign-in');
  }

  const store = await cookies();
  const lang: Lang = resolveLang(store.get('lang')?.value);
  const t = translations[lang].auth;

  const message = params.error ? t.signUpFailed : undefined;

  return (
    <AuthCard
      mode="sign-up"
      action={requestPasswordSignUp}
      redirectTo={redirectTo}
      status={message ? 'error' : undefined}
      message={message}
    />
  );
}
