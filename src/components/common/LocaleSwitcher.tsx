// ============================================================================
//  LocaleSwitcher — 4 tilli qoida (dropdown). Header va MobileNav da ishlatiladi.
//  Tanlov IntlContext orqali localStorage'da saqlanadi.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useI18n, LOCALES, type Locale } from '../../i18n/IntlContext.tsx';

// Har til uchun bayroq (emoji). uz va uz-Cyrl — O'zbekiston bayrog'i.
const FLAG: Record<Locale, string> = {
  uz: '🇺🇿',
  'uz-Cyrl': '🇺🇿',
  ru: '🇷🇺',
  en: '🇬🇧',
};

interface Props {
  className?: string;
  /** 'pill' — Header toolbar uslubidagi ochiq tugma; 'icon' — faqat glob (mobil). */
  variant?: 'pill' | 'icon';
}

export const LocaleSwitcher: React.FC<Props> = ({ className = '', variant = 'pill' }) => {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (l: Locale) => {
    setLocale(l);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('nav.language')}
        title={t('nav.language')}
        className={
          variant === 'icon'
            ? 'flex h-10 w-10 items-center justify-center rounded-xl text-[#5E6C84] hover:bg-gray-50 transition-colors cursor-pointer'
            : 'flex h-10 w-11 items-center justify-center rounded-xl border border-[#EBECF0] hover:bg-gray-50 transition-colors cursor-pointer'
        }
      >
        <span className="text-lg sm:text-xl leading-none">{FLAG[locale]}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl border border-gray-100 shadow-xl py-1.5 z-[60]">
          <p className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {t('nav.language')}
          </p>
          {LOCALES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => pick(l.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-sm text-left transition-colors cursor-pointer ${
                locale === l.id ? 'text-[#1673E6] font-bold bg-blue-50/60' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{FLAG[l.id]}</span>
                {l.label}
              </span>
              {locale === l.id && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocaleSwitcher;
