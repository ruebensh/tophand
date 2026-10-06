// ============================================================================
//  LegalPage — huquqiy / axborot sahifalari (AdSense tasdiqi uchun shart).
// ----------------------------------------------------------------------------
//  Bitta komponent turli `kind` qiymatlari orqali 4 sahifani chiqaradi:
//    'privacy' | 'terms' | 'about' | 'contact'
//  App.tsx routing: /privacy, /terms, /about, /contact.
//  Kontent tillari: uz/ru/en yozilgan (i18n/legalContent.ts), uz-Cyrl esa
//  uz lotin matnidan transliteratsiya qilinadi.
// ============================================================================

import React from 'react';
import { Mail, Phone, MapPin, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/IntlContext.tsx';
import {
  getLegalDocs,
  LEGAL_ICONS,
  CONTACT_EMAIL,
  UPDATED,
  type LegalKind,
} from '../i18n/legalContent.ts';

export type { LegalKind };

export const LegalPage: React.FC<{ kind: LegalKind; onNavigate: (route: string) => void }> = ({
  kind,
  onNavigate,
}) => {
  const { t, locale } = useI18n();
  const doc = getLegalDocs(locale)[kind];
  if (!doc) return null;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
      <button
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E6C84] hover:text-[#1673E6] mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> {t('nav.home')}
      </button>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-7 border-b border-gray-100 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
            {LEGAL_ICONS[kind]}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900">{doc.title}</h1>
            <p className="text-xs text-gray-500 mt-1">{doc.subtitle}</p>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-6">
          {doc.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-sm font-bold text-gray-900 mb-2">{s.h}</h2>
              {s.p.map((para, j) => (
                <p key={j} className="text-sm text-gray-600 leading-relaxed mb-2">
                  {para}
                </p>
              ))}
              {s.list && (
                <ul className="mt-1 space-y-1.5">
                  {s.list.map((li, k) => (
                    <li key={k} className="text-sm text-gray-600 leading-relaxed flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>{li}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {kind === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-700">{CONTACT_EMAIL}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <Phone className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-700">tophand.uz</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-100 sm:col-span-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-700">{t('legal.contactLocation')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-7 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">{t('legal.lastUpdated')}: {UPDATED}</span>
          <span className="text-[11px] text-gray-400">© {new Date().getFullYear()} TopHand</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
