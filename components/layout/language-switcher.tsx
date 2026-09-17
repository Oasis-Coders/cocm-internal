import { nextLang, langLabels, type Lang } from '@/lib/i18n/translations';

type LanguageSwitcherDarkProps = {
  lang: Lang;
};

/**
 * Dark-variant language cycler for the deep-blue sidebar: 简体 → 繁體 → English.
 * Posts to /api/lang which sets the `lang` cookie and redirects back.
 */
export function LanguageSwitcherDark({ lang }: LanguageSwitcherDarkProps) {
  const target = nextLang(lang);
  return (
    <form action="/api/lang" method="post">
      <input type="hidden" name="lang" value={target} />
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M1.5 8h13M8 1.5c-4.5 4-4.5 9 0 13M8 1.5c4.5 4 4.5 9 0 13" />
        </svg>
        {langLabels[target]}
      </button>
    </form>
  );
}
