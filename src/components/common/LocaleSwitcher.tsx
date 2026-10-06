// ============================================================================
//  LocaleSwitcher — 4 tilli qoida (dropdown). Header va MobileNav da ishlatiladi.
//  Tanlov IntlContext orqali localStorage'da saqlanadi.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n, LOCALES, type Locale } from '../../i18n/IntlContext.tsx';

// Qisqa ko'rsatkich (tugma ustida) — uzunlikni tejash uchun.
const SHORT: Record<Locale, string> = {
  uz: "O'zbekcha",
  'uz-Cyrl': 'Ўзбекча',
  ru: 'Русский',
  en: 'English',
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
            : 'flex items-center gap-1.5 h-10 px-2.5 sm:px-3 rounded-xl text-sm font-semibold text-[#172B4D] hover:bg-gray-50 border border-[#EBECF0] transition-colors cursor-pointer'
        }
      >
        <Globe className="w-5 h-5 sm:w-4 sm:h-4 th-accent-text shrink-0" />
        {variant === 'pill' && <span className="hidden md:inline">{SHORT[locale]}</span>}
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
              <span>{l.label}</span>
              {locale === l.id && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocaleSwitcher;
