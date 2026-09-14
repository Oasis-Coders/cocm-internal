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
  'mt-3 w-full rounded-card border-[1.5px] border-cocm-ink/15 bg-white px-4 py-3 text-base text-cocm-ink outline-none transition placeholder:text-cocm-ink/40 focus:border-cocm-slate focus:ring-2 focus:ring-cocm-slate/20';

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
      : 'border-cocm-red-light bg-cocm-red-light text-cocm-ink';

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
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-cocm-ink">{copy.title}</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-cocm-slate">{copy.description}</p>

        {message ? (
          <div className={`mt-6 rounded-xl border p-4 text-sm ${alertClassName}`}>{message}</div>
        ) : null}

        <form
          action={action}
          className="border-cocm-ink/8 mt-8 rounded-card border bg-white p-6 shadow-card"
        >
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {mode === 'sign-up' ? (
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-semibold text-cocm-ink"
              >
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

          <label
            htmlFor="email"
            className={`${mode === 'sign-up' ? 'mt-5' : ''} block text-sm font-semibold text-cocm-ink`}
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

          <label htmlFor="password" className="mt-5 block text-sm font-semibold text-cocm-ink">
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

          <button
            type="submit"
            className="mt-6 rounded-xl bg-cocm-red px-6 py-3 font-semibold text-white shadow-red-glow transition-all hover:bg-cocm-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocm-red/40"
          >
            {copy.submit}
          </button>
        </form>

        <p className="mt-6 text-sm text-cocm-slate">
          {copy.alternateLabel}{' '}
          <Link
            href={copy.alternateHref}
            className="font-semibold text-cocm-red underline underline-offset-2"
          >
            {copy.alternateCta}
          </Link>
        </p>

        {mode === 'sign-in' && forgotPasswordLabel ? (
          <p className="mt-3 text-sm text-cocm-slate">
            <Link
              href="/forgot-password"
              className="font-semibold text-cocm-red underline underline-offset-2"
            >
              {forgotPasswordLabel}
            </Link>
          </p>
        ) : null}

        <form action="/api/lang" method="post" className="mt-4">
          <input type="hidden" name="lang" value={lang === 'zh' ? 'en' : 'zh'} />
          <button type="submit" className="text-sm font-semibold text-cocm-slate underline underline-offset-2">
            {lang === 'zh' ? 'English' : '中文'}
          </button>
        </form>
      </div>
    </main>
  );
}
