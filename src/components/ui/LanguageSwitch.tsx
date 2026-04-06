import type { Locale } from '../../i18n/messages'
import { useI18n } from '../../i18n/I18nContext'

const LOCALES: Locale[] = ['en', 'fr']

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function LanguageSwitch({
  className = '',
  size = 'md',
}: {
  className?: string
  /** `sm` for dense headers; `md` for login / hero */
  size?: 'sm' | 'md'
}) {
  const { locale, setLocale, t } = useI18n()

  const track =
    size === 'sm'
      ? 'rounded-full p-0.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]'
      : 'rounded-full p-1 shadow-[inset_0_1px_3px_rgba(15,23,42,0.1)]'

  const btnBase =
    'relative rounded-full font-semibold tracking-[0.12em] transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white'

  const btnSize =
    size === 'sm'
      ? 'min-w-[2.25rem] px-2 py-1 text-[10px]'
      : 'min-w-[3rem] px-3 py-1.5 text-[11px]'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur-sm',
        size === 'sm' && 'gap-1.5 px-1 py-0.5',
        className,
      )}
      role="group"
      aria-label={t('language.switch')}
    >
      <span
        className={cn(
          'hidden shrink-0 text-slate-400 sm:inline-flex',
          size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </span>
      <div
        className={cn(
          'flex bg-gradient-to-b from-slate-100 to-slate-200/60',
          track,
        )}
      >
        {LOCALES.map((loc) => {
          const active = locale === loc
          return (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              title={loc === 'en' ? t('lang.enHint') : t('lang.frHint')}
              className={cn(
                btnBase,
                btnSize,
                active
                  ? 'bg-white text-sky-700 shadow-[0_1px_3px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.04)]'
                  : 'text-slate-500 hover:text-slate-800',
              )}
              aria-pressed={active}
            >
              {t(loc === 'en' ? 'lang.en' : 'lang.fr')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
