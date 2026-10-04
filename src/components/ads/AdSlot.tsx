// ============================================================================
//  AdSlot — barcha reklama joylashuvlari uchun umumiy "uyya".
// ----------------------------------------------------------------------------
//  `adConfig.ts` da tarmoq ulanmagan (`AD_NETWORK === 'none'`) paytda chiroyli
//  placeholder ko'rsatadi. Kelajakda tarmoq ulansa — AYNI SHU komponent ichida
//  real reklama kodini (masalan <ins class="adsbygoogle">) render qiladigan qilib
//  kengaytiriladi; sahifalarni qayta o'zgartirish shart emas.
//
//  variant:
//    - 'banner' : keng, past balandlik (header osti / mashxur o'rni)
//    - 'card'   : e'lonlar gridi ichida, xuddi ListingCard o'lchamida
//    - 'box'    : filtr paneli ostidagi tik to'rtburchak
//  dismissible + storageKey berilsa, foydalanuvchi uni yopa oladi va qaror
//  localStorage'da saqlanadi (sahifalar aylanishida yana chiqmaydi).
// ============================================================================

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AD_PLACEHOLDER_LABEL, type AdPlacement } from './adConfig.ts';
import { useAds } from '../../context/AdsContext.tsx';

type Variant = 'banner' | 'card' | 'box';

export function AdSlot({
  placement,
  variant = 'box',
  title,
  className = '',
  dismissible = false,
  storageKey,
}: {
  placement: AdPlacement;
  variant?: Variant;
  title?: string;
  className?: string;
  dismissible?: boolean;
  storageKey?: string;
}) {
  const { ads } = useAds();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!dismissible || !storageKey) return;
    try {
      if (localStorage.getItem(storageKey) === '1') setHidden(true);
    } catch {
      /* localStorage mavjud bo'lmasa e'tibor bermaymiz */
    }
  }, [dismissible, storageKey]);

  // Admin monetizatsiya panelidagi toggle'lar — yagona haqiqat manbai.
  // Master o'chiq yoki bu joylashuv o'chiq bo'lsa — Hech narsa ko'rsatilmaydi.
  const placementOn = ads.enabled && Boolean(ads[placement]);
  if (!placementOn || hidden) return null;

  const close = () => {
    setHidden(true);
    if (dismissible && storageKey) {
      try {
        localStorage.setItem(storageKey, '1');
      } catch {
        /* ignore */
      }
    }
  };

  const tag = (
    <span className="absolute top-2 left-2 z-10 rounded-md bg-white/80 border border-[#DDE7F7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5E6C84]">
      {AD_PLACEHOLDER_LABEL}
    </span>
  );

  const closeBtn = dismissible ? (
    <button
      type="button"
      onClick={close}
      aria-label="Reklamani yopish"
      className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 border border-[#DDE7F7] text-[#5E6C84] hover:text-[#172B4D] hover:bg-white cursor-pointer"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  ) : null;

  // ---- Real tarmoq shu yerga keladi (hozircha placeholder) ----------------
  // adConfig.AD_NETWORK === 'adsense' && cfg.unit bo'lsa: <AdsenseSlot unit={cfg.unit} />

  const shell =
    'relative overflow-hidden rounded-2xl border border-[#EBECF0] bg-gradient-to-br from-[#F5F8FF] to-[#EEF4FF]';

  if (variant === 'banner') {
    return (
      <div className={`${shell} ${className}`}>
        {tag}
        {closeBtn}
        <div className="flex min-h-[64px] items-center justify-center px-12 py-3 text-center">
          <p className="text-sm font-extrabold text-[#172B4D]">
            {title || 'Bu yerga reklama joylashtiriladi'}
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`relative overflow-hidden rounded-2xl border border-[#EBECF0] bg-white ${className}`}>
        <span className="absolute top-2 left-2 z-10 rounded-md bg-white/80 border border-[#DDE7F7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5E6C84]">
          {AD_PLACEHOLDER_LABEL}
        </span>
        <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-[#F5F8FF] to-[#EEF4FF]">
          <span className="text-3xl">📣</span>
        </div>
        <div className="p-3">
          <div className="h-3.5 w-3/4 rounded bg-gray-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
          <p className="mt-2 text-[11px] font-medium text-[#5E6C84]">Reklama uchun joy</p>
        </div>
      </div>
    );
  }

  // variant === 'box' (sidebar)
  return (
    <div className={`${shell} ${className}`}>
      {tag}
      {closeBtn}
      <div className="flex min-h-[130px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <span className="text-2xl">📣</span>
        <p className="text-xs font-bold text-[#172B4D]">{title || 'Reklama uchun joy'}</p>
        <p className="text-[11px] text-[#5E6C84]">Mahsulotingizni shu yerga joylashtiring</p>
      </div>
    </div>
  );
}
