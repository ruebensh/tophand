// Reklama uchun ajratilgan joy — kategoriya uchun "mashxur" atribut sozlanmagan
// bo'lsa (masalan SPA/massaj) toolbar ostidagi qatorda ko'rsatiladi.
// Admin yaratgan "popular" kampaniya bo'lsa — u chiqadi; aks holda placeholder.
// Admin monetizatsiya panelidagi "popular" slot yoqilmaganda — umuman ko'rsatilmaydi.

import { useEffect, useRef, useState } from 'react';
import { useAds } from '../../context/AdsContext.tsx';
import { trackAdEvent } from '../../lib/api.ts';
import type { AdCampaign } from '../../types/index.ts';

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function CategoryAdSlot({ title }: { title?: string }) {
  const { ads, campaigns } = useAds();
  const rawList: AdCampaign[] = ads.enabled && ads.popular ? campaigns.popular || [] : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (rawList.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % rawList.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [rawList.length, isPaused]);

  const camp: AdCampaign | undefined = rawList[activeIdx % (rawList.length || 1)];

  const trackedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (camp && !trackedRef.current.has(camp.id)) {
      trackedRef.current.add(camp.id);
      trackAdEvent(camp.id, 'impression');
    }
  }, [camp?.id]);

  if (!ads.enabled || !ads.popular) return null;

  // ---- Real "popular" kampaniyasi ----
  if (camp) {
    const external = isExternal(camp.link_url);
    const linkProps = external
      ? { href: camp.link_url, target: '_blank', rel: 'noopener sponsored' }
      : { href: camp.link_url };
    return (
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative overflow-hidden rounded-2xl border border-[#EBECF0] bg-white hover:shadow-xs transition-shadow"
      >
        <a
          {...linkProps}
          onClick={() => trackAdEvent(camp.id, 'click')}
          className="flex items-center gap-3 px-3 py-3 sm:px-4"
        >
          <span className="absolute top-2 right-2 rounded-md bg-white/85 border border-[#DDE7F7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5E6C84]">
            Reklama
          </span>
          {camp.image_url && (
            <div className="hidden sm:flex h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              <img src={camp.image_url} alt={camp.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[#172B4D] truncate">{camp.title}</p>
            {camp.body && <p className="text-xs text-[#5E6C84] mt-0.5 line-clamp-1">{camp.body}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {rawList.length > 1 && (
              <div className="hidden md:flex items-center gap-1 mr-1">
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
                      i === activeIdx % rawList.length ? 'w-3.5 bg-[#1673E6]' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Reklama ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1673E6] px-3 py-1.5 text-[11px] font-bold text-white">
              {camp.cta_label || 'Batafsil'} <span aria-hidden>→</span>
            </span>
          </div>
        </a>
      </div>
    );
  }

  // ---- Placeholder ----
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#EBECF0] bg-gradient-to-br from-[#F5F8FF] to-[#EEF4FF] px-4 py-4 sm:px-6">
      <span className="absolute top-2 right-2 rounded-md bg-white/70 border border-[#DDE7F7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#5E6C84]">
        Reklama
      </span>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1673E6]/10 text-[#1673E6] text-lg">
          📣
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[#172B4D] truncate">
            {title ? `${title} — e’loningizni birinchi ko‘rsating` : 'Bu yerga reklama joylashtiriladi'}
          </p>
          <p className="text-xs text-[#5E6C84] mt-0.5">
            Ko‘rinuvchan joy: mahsulotingiz yoki xizmatingiz eng tepada.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CategoryAdSlot;
