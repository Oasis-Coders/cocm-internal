import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { resolveDisplayName } from '@/lib/auth/auth-utils';
import { getSession } from '@/lib/auth/session';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveLang, translations, type Lang } from '@/lib/i18n/translations';

type AccountSettingsProps = {
  searchParams: {
    profile?: string;
    credentials?: string;
  };
};

async function updateProfile(formData: FormData) {
  'use server';

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/profile?profile=unavailable');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in?redirectTo=/profile');

  const displayName = String(formData.get('displayName') ?? '').trim();
  if (!displayName) redirect('/profile?profile=missing-fields');

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id);

  if (error) redirect('/profile?profile=error');

  await supabase.auth.updateUser({ data: { display_name: displayName } });

  revalidatePath('/profile');
  redirect('/profile?profile=saved');
}

async function updateCredentials(formData: FormData) {
  'use server';

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/profile?credentials=unavailable');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in?redirectTo=/profile');

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!password && (!email || email === user.email)) {
    redirect('/profile?credentials=no-change');
  }

  const payload: { email?: string; password?: string } = {};
  if (email && email !== user.email) payload.email = email;
  if (password) payload.password = password;

  const { error } = await supabase.auth.updateUser(payload);
  if (error) redirect('/profile?credentials=error');

  revalidatePath('/profile');
  redirect('/profile?credentials=saved');
}

function Alert({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-rose-200 bg-rose-50 text-rose-900'
      }`}
    >
      {text}
    </div>
  );
}

export async function AccountSettings({ searchParams }: AccountSettingsProps) {
  const store = await cookies();
  const lang: Lang = resolveLang(store.get('lang')?.value);
  const t = translations[lang].profile;
  const session = await getSession();

  const displayName = resolveDisplayName({
    displayName: session.displayName,
    email: session.email,
  });

  const profileMessage =
    searchParams.profile === 'saved'
      ? { tone: 'success' as const, text: t.profileSaved }
      : searchParams.profile
        ? { tone: 'error' as const, text: translations[lang].auth.invalidCredentials }
        : null;

  const credentialMessage =
    searchParams.credentials === 'saved'
      ? { tone: 'success' as const, text: t.credentialsSaved }
      : searchParams.credentials
        ? { tone: 'error' as const, text: translations[lang].auth.invalidCredentials }
        : null;

  const inputClassName =
    'mt-2 w-full rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-4 py-3 text-[15px] text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 hover:border-cocm-ink/25 focus:border-cocm-red focus:ring-2 focus:ring-cocm-red/20';

  return (
    <>
      <article className="rounded-[20px] border border-cocm-ink/10 bg-white p-6 shadow-card md:p-7">
        <p className="text-xs uppercase tracking-[0.25em] text-cocm-slate">{t.eyebrow}</p>
        <h3 className="mt-3 font-serif text-2xl text-cocm-ink">{displayName}</h3>
        <dl className="mt-6 grid gap-4 text-sm text-cocm-slate md:grid-cols-3">
          <div>
            <dt className="font-semibold">{t.email}</dt>
            <dd className="mt-1 break-all">{session.email || '—'}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t.role}</dt>
            <dd className="mt-1 capitalize">{session.role.replace('_', ' ')}</dd>
          </div>
        </dl>
      </article>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-[20px] border border-cocm-ink/10 bg-white p-6 shadow-card md:p-7">
          <p className="text-xs uppercase tracking-[0.25em] text-cocm-slate">{t.displayName}</p>
          <h3 className="mt-3 font-serif text-2xl text-cocm-ink">{t.displayName}</h3>

          {profileMessage ? (
            <div className="mt-4">
              <Alert {...profileMessage} />
            </div>
          ) : null}

          {hasSupabaseEnv() ? (
            <form action={updateProfile} className="mt-6 space-y-5">
              <div>
                <label htmlFor="displayName" className="block text-sm font-semibold text-cocm-ink">
                  {t.displayName}
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  autoComplete="nickname"
                  defaultValue={session.displayName}
                  className={inputClassName}
                />
              </div>

              <button
                type="submit"
                className="rounded-[12px] bg-cocm-red px-5 py-3 font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98]"
              >
                {t.saveProfile}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-cocm-slate">
              {translations[lang].auth.supabaseUnavailable}
            </p>
          )}
        </article>

        <article className="rounded-[20px] border border-cocm-ink/10 bg-white p-6 shadow-card md:p-7">
          <p className="text-xs uppercase tracking-[0.25em] text-cocm-slate">{t.email}</p>
          <h3 className="mt-3 font-serif text-2xl text-cocm-ink">{t.saveCredentials}</h3>

          {credentialMessage ? (
            <div className="mt-4">
              <Alert {...credentialMessage} />
            </div>
          ) : null}

          {hasSupabaseEnv() ? (
            <form action={updateCredentials} className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-cocm-ink">
                  {t.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={session.email}
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-cocm-ink">
                  {t.updatePassword}{' '}
                  <span className="font-normal text-cocm-slate">({t.updatePasswordHint})</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t.updatePasswordHint}
                  className={inputClassName}
                />
              </div>

              <button
                type="submit"
                className="rounded-[12px] bg-cocm-red px-5 py-3 font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.98]"
              >
                {t.saveCredentials}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-cocm-slate">
              {translations[lang].auth.supabaseUnavailable}
            </p>
          )}
        </article>
      </div>
    </>
  );
}
