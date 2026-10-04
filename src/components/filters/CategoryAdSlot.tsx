// Reklama uchun ajratilgan joy — kategoriya uchun "mashxur" atribut sozlanmagan
// bo'lsa (masalan SPA/massaj) toolbar ostidagi qatorda ko'rsatiladi.
// Hozircha ichki placeholder: kelajakda tashqi reklama manbani ulash uchun toza joy.
// Admin monetizatsiya panelidagi "popular" slot yoqilmaganda — umuman ko'rsatilmaydi.

import { useAds } from '../../context/AdsContext.tsx';

export function CategoryAdSlot({ title }: { title?: string }) {
  const { ads } = useAds();
  if (!ads.enabled || !ads.popular) return null;

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
