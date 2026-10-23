import React from 'react';
import { useI18n } from '../i18n/IntlContext.tsx';

// ─── 404 — noma'lum yo'l sahifasi ───
// Brend illiustratsiyasi (/not-found.webp) + "Bosh sahifaga" qaytish tugmasi.
// Server ham bu yo'llarga HTTP 404 status beradi (SEO: indekslanmaydi).
export const NotFoundPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { t } = useI18n();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-20 text-center">
      <img
        src="/404.webp"
        alt="404"
        width={640}
        height={452}
        decoding="async"
        className="w-72 sm:w-[640px] max-w-full h-auto object-contain select-none"
      />
      {/* Brend "eyebrow" — tarjimasi yo'q, hammasida bir xil */}
      <p className="mt-8 font-mono font-bold tracking-[0.3em] text-[11px] sm:text-xs text-[#1673E6] uppercase">
        404 — TopHand
      </p>
      <h2 className="mt-2 font-extrabold text-lg sm:text-2xl text-[#172B4D]">{t('notFound.title')}</h2>
      <p className="mt-2 text-sm sm:text-base text-[#5E6C84] max-w-md leading-relaxed">
        {t('notFound.body')}
      </p>
      <button
        onClick={() => onNavigate('/')}
        className="mt-7 px-7 py-2.5 rounded-full bg-[#1673E6] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-xs"
      >
        {t('notFound.back')}
      </button>
    </div>
  );
};

export default NotFoundPage;
