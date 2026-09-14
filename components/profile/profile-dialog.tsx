'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useT } from '@/lib/i18n/use-t';
import { cn } from '@/lib/utils';
import { updateDisplayNameAction, updatePasswordAction } from './profile-actions';

type Props = {
  displayName: string;
  email: string;
  roleLabel: string;
  avatarInitial: string;
};

export function ProfileDialog({ displayName, email, roleLabel, avatarInitial }: Props) {
  const { t, lang } = useT();
  const router = useRouter();
  const isZh = lang === 'zh';

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [password, setPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setName(displayName);
    setPassword('');
    setNameMsg(null);
    setPwMsg(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, displayName]);

  const saveName = async () => {
    setSavingName(true);
    setNameMsg(null);
    try {
      const res = await updateDisplayNameAction(name);
      if (res.ok) {
        setNameMsg({ tone: 'ok', text: t.profile.profileSaved });
        router.refresh();
      } else {
        setNameMsg({ tone: 'err', text: t.auth.invalidCredentials });
      }
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    setSavingPw(true);
    setPwMsg(null);
    try {
      const res = await updatePasswordAction(password);
      if (res.ok) {
        setPwMsg({ tone: 'ok', text: t.profile.credentialsSaved });
        setPassword('');
      } else if (res.error === 'too-short') {
        setPwMsg({
          tone: 'err',
          text: isZh ? '密码至少需要 6 位。' : 'Password must be at least 6 characters.',
        });
      } else {
        setPwMsg({ tone: 'err', text: t.auth.invalidCredentials });
      }
    } finally {
      setSavingPw(false);
    }
  };

  const msgClass = (tone: 'ok' | 'err') =>
    tone === 'ok' ? 'text-emerald-700' : 'text-cocm-red';

  return (
    <>
      {/* Trigger: the identity card */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group block w-full rounded-[10px] border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.10]"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
          {isZh ? '当前身份' : 'Role'}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-cocm-red text-[12px] font-bold text-white">
            {avatarInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-white/90">{displayName || email}</p>
            <p className="text-[10px] text-white/50">{roleLabel}</p>
          </div>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Dialog */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t.profile.title}
        >
          <button
            type="button"
            aria-label={isZh ? '关闭' : 'Close'}
            onClick={close}
            className="absolute inset-0 cursor-default bg-cocm-ink/45 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-[400px] overflow-hidden rounded-[24px] bg-white shadow-panel">
            <div className="relative overflow-hidden bg-[linear-gradient(135deg,#363a9e_0%,#2d2f92_55%,#c9333b_130%)] px-5 pb-5 pt-5 text-white">
              <div
                className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cocm-red/30 blur-[24px]"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={close}
                aria-label={isZh ? '关闭' : 'Close'}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
                </svg>
              </button>
              <div className="relative flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-cocm-red text-[18px] font-bold text-white shadow-red-glow">
                  {avatarInitial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold tracking-tight">
                    {displayName || email}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-white/65">{email}</p>
                  <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div>
                <label
                  htmlFor="profile-dialog-name"
                  className="block text-[13px] font-semibold text-cocm-ink"
                >
                  {t.profile.displayName}
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="profile-dialog-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="nickname"
                    className="min-w-0 flex-1 rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-3.5 py-2.5 text-[14px] text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 focus:border-cocm-blue"
                  />
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={savingName || !name.trim()}
                    className="shrink-0 rounded-[12px] bg-cocm-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-cocm-ink-light disabled:opacity-50"
                  >
                    {t.common.save}
                  </button>
                </div>
                {nameMsg && (
                  <p className={cn('mt-1.5 text-[12px]', msgClass(nameMsg.tone))}>{nameMsg.text}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profile-dialog-password"
                  className="block text-[13px] font-semibold text-cocm-ink"
                >
                  {t.profile.updatePassword}
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="profile-dialog-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={isZh ? '至少 6 位' : 'Min 6 characters'}
                    className="min-w-0 flex-1 rounded-[12px] border-[1.5px] border-cocm-ink/15 bg-white px-3.5 py-2.5 text-[14px] text-cocm-ink outline-none transition placeholder:text-cocm-ink/35 focus:border-cocm-blue"
                  />
                  <button
                    type="button"
                    onClick={savePassword}
                    disabled={savingPw || password.length < 6}
                    className="shrink-0 rounded-[12px] bg-cocm-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-cocm-ink-light disabled:opacity-50"
                  >
                    {t.common.save}
                  </button>
                </div>
                {pwMsg && (
                  <p className={cn('mt-1.5 text-[12px]', msgClass(pwMsg.tone))}>{pwMsg.text}</p>
                )}
              </div>

              <Link
                href="/profile"
                onClick={close}
                className="flex items-center justify-center gap-1.5 rounded-[12px] border border-cocm-ink/10 bg-cocm-ink/[0.03] px-4 py-2.5 text-[13px] font-medium text-cocm-ink transition hover:bg-cocm-ink/[0.06]"
              >
                {isZh ? '更多设置' : 'More settings'}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
