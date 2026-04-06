import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { type Locale, type MessageId, messagesByLocale } from './messages'

const STORAGE_KEY = 'malambi:locale'

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'fr' || raw === 'en') return raw
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')) {
    return 'fr'
  }
  return 'en'
}

type I18nContextValue = {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (id: MessageId) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next === 'fr' ? 'fr' : 'en'
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'fr' ? 'fr' : 'en'
  }, [locale])

  const t = useCallback(
    (id: MessageId) => {
      return messagesByLocale[locale][id] ?? messagesByLocale.en[id] ?? id
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
