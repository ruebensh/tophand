// ============================================================================
//  IntlContext — core.ts ustidagi React qatlami. Provider faol lugalni
//  holatda ushlaydi, localStorage/documentElement.lang ga yozadi va core'ning
//  setActiveLocale() ni yangilaydi (shunda React-siz util funksiyalar ham
//  to'g'ri tilda ishlaydi).
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type Locale,
  LOCALES,
  STORAGE_KEY,
  INTL_LOCALE,
  setActiveLocale,
  translate,
  localizeName,
  detectInitialLocale,
} from './core.ts';

export { type Locale, LOCALES };

interface IntlContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  localized: (obj: Record<string, any> | null | undefined, base?: string) => string;
  intlLocale: string;
  isCyrillic: boolean;
}

const IntlContext = createContext<IntlContextValue | null>(null);

export function IntlProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = detectInitialLocale();
    setActiveLocale(initial);
    return initial;
  });

  useEffect(() => {
    setActiveLocale(locale);
    try {
      document.documentElement.lang = locale;
    } catch {
      /* SSR / hujjat yo'q */
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setActiveLocale(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, vars, locale),
    [locale],
  );
  const localized = useCallback(
    (obj: Record<string, any> | null | undefined, base = 'name') => localizeName(obj, base, locale),
    [locale],
  );

  const value = useMemo<IntlContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      localized,
      intlLocale: INTL_LOCALE[locale],
      isCyrillic: locale === 'uz-Cyrl',
    }),
    [locale, setLocale, t, localized],
  );

  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>;
}

export function useI18n(): IntlContextValue {
  const ctx = useContext(IntlContext);
  if (!ctx) throw new Error('useI18n must be used within IntlProvider');
  return ctx;
}

export default IntlProvider;
