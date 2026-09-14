import Link from 'next/link';
import { cookies } from 'next/headers';

import { AuthShell } from '@/components/auth/auth-shell';
import { translations, type Lang } from '@/lib/i18n/translations';

type AuthCardProps = {
  mode: 'sign-in' | 'sign-up';
  action: (formData: FormData) => Promise<void>;
  redirectTo: string;
  status?: 'success' | 'error';
  message?: string;
  forgotPasswordLabel?: string;
};

const inputClassName =
  'mt-2 h-11 w-full rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-4 text-[15px] text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 hover:border-cocm-ink/25 focus:border-cocm-blue focus:ring-2 focus:ring-cocm-blue/20';

const labelClassName = 'block text-[13px] font-semibold tracking-[0.01em] text-cocm-ink';

export async function AuthCard({ mode, action, redirectTo, status, message, forgotPasswordLabel }: AuthCardProps) {
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].auth;

  const copy =
    mode === 'sign-in'
      ? {
          title: t.signInTitle,
          subtitle: t.signInDesc,
          submit: t.signInCta,
          alternateLabel: t.noAccount,
          alternateHref: '/sign-up',
          alternateCta: t.createOne,
        }
      : {
          title: t.signUpTitle,
          subtitle: t.signUpDesc,
          submit: t.signUpCta,
          alternateLabel: t.hasAccount,
          alternateHref: '/sign-in',
          alternateCta: t.signInInstead,
        };

  const alertClassName =
    status === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-cocm-red/20 bg-cocm-red-light/60 text-cocm-ink';

  return (
    <AuthShell lang={lang} title={copy.title} subtitle={copy.subtitle}>
      {message ? (
        <div className={`mb-4 rounded-[12px] border p-4 text-sm leading-relaxed ${alertClassName}`} role="alert">
          {message}
        </div>
      ) : null}

      <form action={action} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        {mode === 'sign-up' ? (
          <div>
            <label htmlFor="displayName" className={labelClassName}>
              {t.displayName}
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              autoComplete="nickname"
              placeholder={t.displayNamePlaceholder}
              className={inputClassName}
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className={labelClassName}>
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

        <div>
          <label htmlFor="password" className={labelClassName}>
            {t.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            placeholder={mode === 'sign-in' ? t.passwordPlaceholderSignIn : t.passwordPlaceholderSignUp}
            className={inputClassName}
          />
        </div>

        <button
          type="submit"
          className="h-11 w-full rounded-[12px] bg-cocm-blue px-6 text-[15px] font-semibold text-white transition-all hover:bg-[#3f43a8] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-blue/40"
        >
          {copy.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-cocm-slate">
        {copy.alternateLabel}{' '}
        <Link
          href={copy.alternateHref}
          className="font-semibold text-cocm-blue underline-offset-2 hover:underline"
        >
          {copy.alternateCta}
        </Link>
      </p>

      {mode === 'sign-in' && forgotPasswordLabel ? (
        <p className="mt-3 text-center text-sm text-cocm-slate">
          <Link
            href="/forgot-password"
            className="font-semibold text-cocm-blue underline-offset-2 hover:underline"
          >
            {forgotPasswordLabel}
          </Link>
        </p>
      ) : null}

      <form action="/api/lang" method="post" className="mt-6 flex justify-center">
        <input type="hidden" name="lang" value={lang === 'zh' ? 'en' : 'zh'} />
        <button
          type="submit"
          className="rounded-full border border-cocm-ink/15 px-4 py-1.5 text-[13px] font-semibold text-cocm-slate transition hover:border-cocm-ink/30 hover:text-cocm-ink"
        >
          {lang === 'zh' ? 'English' : '中文'}
        </button>
      </form>
    </AuthShell>
  );
}
