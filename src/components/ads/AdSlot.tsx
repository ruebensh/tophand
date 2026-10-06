// ============================================================================
//  AdSlot — barcha reklama joylashuvlari uchun umumiy "uyya".
// ----------------------------------------------------------------------------
//  Ustuvorlik tartibi:
//    1) Admin yaratgan AKTIV kampaniya bor bo'lsa → real reklama (rasm/video/matn
//       + "Batafsil" CTA + havola). Impression/click hisoblanadi.
//    2) Kampaniya yo'q, lekin slot yoqilgan bo'lsa → ichki placeholder.
//    3) Slot o'chiq yoki master o'chiq → hech narsa ko'rsatilmaydi.
//
//  variant:
//    - 'banner' : keng, past balandlik (header osti / mashxur o'rni)
//    - 'card'   : e'lonlar gridi ichida, xuddi ListingCard o'lchamida
//    - 'box'    : filtr paneli ostidagi tik to'rtburchak
//  dismissible + storageKey berilsa, foydalanuvchi uni yopa oladi (localStorage).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  AD_PLACEHOLDER_LABEL,
  AD_NETWORK,
  AD_PUBLISHER_ID,
  AD_CONFIG,
  AD_ROTATION_INTERVALS,
  type AdPlacement,
} from './adConfig.ts';
import { useAds } from '../../context/AdsContext.tsx';
import { trackAdEvent } from '../../lib/api.ts';
import type { AdCampaign } from '../../types/index.ts';

type Variant = 'banner' | 'card' | 'box';

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// YouTube URL bo'lsa embed ID qaytaradi, aks holda null.
function youtubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Google AdSense birligini render qiluvchi xavfsiz komponent
function GoogleAdSenseSlot({
  placement,
  variant,
  className = '',
}: {
  placement: AdPlacement;
  variant: Variant;
  className?: string;
}) {
  const slotId = AD_CONFIG[placement]?.unit;
  const isPushed = useRef(false);

  useEffect(() => {
    // AdSense skriptini sahifaga 1 marta dinamik yuklash
    const scriptId = 'google-adsense-script';
    if (!document.getElementById(scriptId) && AD_PUBLISHER_ID) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_PUBLISHER_ID}`;
      s.async = true;
      s.crossOrigin = 'anonymous';
      document.head.appendChild(s);
    }

    if (!isPushed.current) {
      try {
        if (typeof window !== 'undefined') {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          isPushed.current = true;
        }
      } catch (e) {
        /* AdSense bloker yoki yuklanish xatosi */
      }
    }
  }, []);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#EBECF0] bg-white p-2 flex items-center justify-center min-h-[90px] ${className}`}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          minHeight: variant === 'card' ? 260 : variant === 'banner' ? 90 : 180,
        }}
        data-ad-client={AD_PUBLISHER_ID}
        data-ad-slot={slotId || undefined}
        data-ad-format={variant === 'card' ? 'rectangle' : variant === 'banner' ? 'horizontal' : 'auto'}
        data-full-width-responsive="true"
      />
    </div>
  );
}

export function AdSlot({
  placement,
  variant = 'box',
  title,
  className = '',
  dismissible = false,
  storageKey,
  slotIndex = 0,
  autoRotate = true,
  rotateInterval,
}: {
  placement: AdPlacement;
  variant?: Variant;
  title?: string;
  className?: string;
  dismissible?: boolean;
  storageKey?: string;
  slotIndex?: number;
  autoRotate?: boolean;
  rotateInterval?: number;
}) {
  const effectiveInterval = rotateInterval ?? (AD_ROTATION_INTERVALS[placement] || 15000);
  const { ads, campaigns } = useAds();
  const [hidden, setHidden] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!dismissible || !storageKey) return;
    try {
      // sessionStorage — faqat joriy brauzer sессияsi uchun (yangi tab/brauzer ochsa qayta ko'rinadi)
      if (sessionStorage.getItem(storageKey) === '1') setHidden(true);
    } catch {
      /* storage mavjud bo'lmasa e'tibor bermaymiz */
    }
  }, [dismissible, storageKey]);

  // Admin monetizatsiya panelidagi toggle'lar — yagona haqiqat manbai.
  const placementOn = ads.enabled && Boolean(ads[placement]);

  // Ushbu joylashuvga mos barcha aktiv kampaniyalar
  const rawList: AdCampaign[] = placementOn ? campaigns[placement] || [] : [];

  // Boshlang'ich indeks: sahifadagi slot o'rniga qarab (slotIndex) taqsimlanadi
  const initialIndex = rawList.length > 0 ? (slotIndex % rawList.length) : 0;
  const [activeIdx, setActiveIdx] = useState(initialIndex);

  // SlotIndex yoki kampaniyalar ro'yxati o'zgarsa indeksni yangilash
  useEffect(() => {
    if (rawList.length > 0) {
      setActiveIdx(slotIndex % rawList.length);
    }
  }, [slotIndex, rawList.length]);

  // Bir nechta kampaniya bo'lsa avtomatik rotatsiya (almashib turish)
  useEffect(() => {
    if (!autoRotate || rawList.length <= 1 || isPaused || hidden) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % rawList.length);
    }, effectiveInterval);
    return () => clearInterval(timer);
  }, [autoRotate, rawList.length, isPaused, hidden, effectiveInterval]);

  const camp: AdCampaign | undefined = rawList.length > 0 ? rawList[activeIdx % rawList.length] : undefined;

  // Impression — har bir ko'rsatilgan kampaniya ID si uchun faqat bir marta qayd etiladi.
  const trackedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (camp && !hidden && !trackedRef.current.has(camp.id)) {
      trackedRef.current.add(camp.id);
      trackAdEvent(camp.id, 'impression');
    }
  }, [camp?.id, hidden]);

  if (!placementOn || hidden) return null;

  const close = () => {
    setHidden(true);
    if (dismissible && storageKey) {
      try {
        // sessionStorage — faqat joriy sessiya uchun yashiriladi
        sessionStorage.setItem(storageKey, '1');
      } catch {
        /* ignore */
      }
    }
  };

  const badge = (
    <span className="absolute top-2 left-2 z-20 rounded-md bg-white/85 border border-[#DDE7F7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5E6C84]">
      {AD_PLACEHOLDER_LABEL}
    </span>
  );

  const closeBtn = dismissible ? (
    <button
      type="button"
      onClick={close}
      aria-label="Reklamani yopish"
      className="absolute top-1.5 right-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 border border-[#DDE7F7] text-[#5E6C84] hover:text-[#172B4D] hover:bg-white cursor-pointer"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  ) : null;

  // Bir nechta reklama bo'lsa navigatsiya nuqtalari
  const dots = rawList.length > 1 ? (
    <div className="flex items-center gap-1.5 py-0.5 z-20">
      {rawList.map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveIdx(i);
          }}
          className={`h-1.5 rounded-full transition-all cursor-pointer ${
            i === activeIdx % rawList.length
              ? 'w-3.5 bg-[#1673E6]'
              : 'w-1.5 bg-gray-300 hover:bg-gray-400'
          }`}
          aria-label={`Reklama ${i + 1}`}
        />
      ))}
    </div>
  ) : null;

  // ---------------------------------------------------------------- REAL AD --
  if (camp) {
    const external = isExternal(camp.link_url);
    const linkProps = external
      ? { href: camp.link_url, target: '_blank', rel: 'noopener sponsored' }
      : { href: camp.link_url };

    const onClick = () => trackAdEvent(camp.id, 'click');

    const cta = (
      <a
        {...linkProps}
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-full bg-[#1673E6] px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors whitespace-nowrap"
      >
        {camp.cta_label || 'Batafsil'}
        <span aria-hidden>→</span>
      </a>
    );

    const yt = camp.type === 'video' && camp.video_url ? youtubeId(camp.video_url) : null;

    const media =
      camp.type === 'image' && camp.image_url ? (
        <img
          src={camp.image_url}
          alt={camp.title}
          className={
            variant === 'card'
              ? 'h-full w-full object-cover transition-opacity duration-300'
              : 'w-full object-cover transition-opacity duration-300'
          }
          style={variant === 'card' ? undefined : { maxHeight: variant === 'banner' ? 120 : 200 }}
          loading="lazy"
        />
      ) : camp.type === 'video' && camp.video_url ? (
        yt ? (
          <iframe
            src={`https://www.youtube.com/embed/${yt}`}
            title={camp.title}
            className="w-full"
            style={{ height: variant === 'banner' ? 120 : variant === 'card' ? '100%' : 200, border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={camp.video_url}
            poster={camp.image_url || undefined}
            autoPlay
            muted
            loop
            playsInline
            className="w-full object-cover"
            style={{ maxHeight: variant === 'banner' ? 120 : variant === 'card' ? '100%' : 200 }}
          />
        )
      ) : null;

    // ---- card variant (grid ichida) ----
    if (variant === 'card') {
      return (
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#EBECF0] bg-white transition-all hover:shadow-md ${className}`}
        >
          {badge}
          {closeBtn}
          <a
            {...linkProps}
            onClick={onClick}
            className="block flex-1"
          >
            <div className="aspect-square overflow-hidden bg-gradient-to-br from-[#F5F8FF] to-[#EEF4FF]">
              {media || (
                <div className="flex h-full items-center justify-center px-3 text-center">
                  <span className="text-sm font-extrabold text-[#172B4D]">{camp.title}</span>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-[13px] font-bold text-gray-900 line-clamp-2 leading-snug">{camp.title}</p>
              {camp.body && <p className="mt-1 text-[11px] text-[#5E6C84] line-clamp-2">{camp.body}</p>}
            </div>
          </a>
          <div className="px-3 pb-3 flex items-center justify-between gap-2">
            <a
              {...linkProps}
              onClick={onClick}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1673E6] hover:underline"
            >
              {camp.cta_label || 'Batafsil'} <span aria-hidden>→</span>
            </a>
            {dots}
          </div>
        </div>
      );
    }

    // ---- banner / box variants ----
    const isBanner = variant === 'banner';
    return (
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative overflow-hidden rounded-2xl border border-[#EBECF0] bg-white transition-all hover:shadow-xs ${className}`}
      >
        {badge}
        {closeBtn}
        <a
          {...linkProps}
          onClick={onClick}
          className={`flex items-center gap-4 ${isBanner ? 'px-4 py-2.5' : 'flex-col px-0 py-0'}`}
        >
          {media && (
            <div className={`shrink-0 overflow-hidden ${isBanner ? 'h-[64px] w-[110px] rounded-lg' : 'w-full'}`}>
              {camp.type === 'image' ? (
                <img src={camp.image_url!} alt={camp.title} className="h-full w-full object-cover transition-opacity duration-300" loading="lazy" />
              ) : (
                media
              )}
            </div>
          )}
          <div className={`min-w-0 ${isBanner ? 'flex-1' : 'w-full px-4 pb-4 pt-1 text-center'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={`font-extrabold text-[#172B4D] ${isBanner ? 'text-sm' : 'text-base'} truncate`}>{camp.title}</p>
              {isBanner && dots}
            </div>
            {camp.body && (
              <p className={`text-[#5E6C84] mt-0.5 ${isBanner ? 'text-xs line-clamp-1' : 'text-xs line-clamp-2'}`}>
                {camp.body}
              </p>
            )}
            <div className={isBanner ? 'mt-1.5 flex items-center justify-between' : 'mt-2.5 flex flex-col items-center gap-2'}>
              <div>{cta}</div>
              {!isBanner && dots}
            </div>
          </div>
        </a>
      </div>
    );
  }

  // ---------------------------------------------------- GOOGLE ADSENSE ----
  if (AD_NETWORK === 'adsense' && AD_PUBLISHER_ID) {
    return <GoogleAdSenseSlot placement={placement} variant={variant} className={className} />;
  }

  // ---------------------------------------------------------- PLACEHOLDER ----
  const shell =
    'relative overflow-hidden rounded-2xl border border-[#EBECF0] bg-gradient-to-br from-[#F5F8FF] to-[#EEF4FF]';

  if (variant === 'banner') {
    return (
      <div className={`${shell} ${className}`}>
        {badge}
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
        {badge}
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
      {badge}
      {closeBtn}
      <div className="flex min-h-[130px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <span className="text-2xl">📣</span>
        <p className="text-xs font-bold text-[#172B4D]">{title || 'Reklama uchun joy'}</p>
        <p className="text-[11px] text-[#5E6C84]">Mahsulotingizni shu yerga joylashtiring</p>
      </div>
    </div>
  );
}

export default AdSlot;
