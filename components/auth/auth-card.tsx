import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';

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
  'mt-2 w-full rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-4 py-3 text-[15px] text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 hover:border-cocm-ink/25 focus:border-cocm-red focus:ring-2 focus:ring-cocm-red/20';

const labelClassName = 'block text-[13px] font-semibold tracking-[0.01em] text-cocm-ink';

export async function AuthCard({ mode, action, redirectTo, status, message, forgotPasswordLabel }: AuthCardProps) {
  const store = await cookies();
  const lang: Lang = store.get('lang')?.value === 'en' ? 'en' : 'zh';
  const t = translations[lang].auth;

  const copy =
    mode === 'sign-in'
      ? {
          eyebrow: t.signInEyebrow,
          title: t.signInTitle,
          description: t.signInDesc,
          submit: t.signInCta,
          alternateLabel: t.noAccount,
          alternateHref: '/sign-up',
          alternateCta: t.createOne,
        }
      : {
          eyebrow: t.signUpEyebrow,
          title: t.signUpTitle,
          description: t.signUpDesc,
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cocm-paper px-4 py-10">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="loading-orb loading-orb-1" />
        <div className="loading-orb loading-orb-2" />
        <div className="loading-orb loading-orb-3" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-[28px] border border-cocm-ink/10 bg-white p-8 shadow-panel md:p-10">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/cocm-logo.png"
              alt="COCM"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover shadow-card ring-1 ring-cocm-ink/10"
              priority
            />
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-cocm-red">
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 font-serif text-[32px] leading-tight tracking-tight text-cocm-ink">
              {copy.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-cocm-slate">{copy.description}</p>
          </div>

          {message ? (
            <div className={`mt-6 rounded-[12px] border p-4 text-sm leading-relaxed ${alertClassName}`} role="alert">
              {message}
            </div>
          ) : null}

          <form action={action} className="mt-6">
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

            <div className={mode === 'sign-up' ? 'mt-4' : ''}>
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

            <div className="mt-4">
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
              className="mt-6 w-full rounded-[12px] bg-cocm-red px-6 py-3.5 text-[15px] font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-red/40"
            >
              {copy.submit}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-cocm-slate">
            {copy.alternateLabel}{' '}
            <Link
              href={copy.alternateHref}
              className="font-semibold text-cocm-red underline-offset-2 hover:underline"
            >
              {copy.alternateCta}
            </Link>
          </p>

          {mode === 'sign-in' && forgotPasswordLabel ? (
            <p className="mt-3 text-center text-sm text-cocm-slate">
              <Link
                href="/forgot-password"
                className="font-semibold text-cocm-red underline-offset-2 hover:underline"
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
        </div>

        <p className="mt-5 text-center text-xs text-cocm-slate/70">
          {lang === 'zh' ? 'COCM 内部系统' : 'COCM Internal System'}
        </p>
      </div>
    </main>
  );
}
