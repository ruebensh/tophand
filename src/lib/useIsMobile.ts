import { useEffect, useState } from 'react';

/**
 * Mobil responsive aniqlagichi: <768px (Tailwind `md` breykpoint — MobileNav
 * ishlatadigan bilan bir xil). Boshqaruv panellari (admin/moderator/lead) mobil
 * ekranda butunlay cheklangan — UI kirishlari yashirin, route'lar bloklangan.
 * Eslatma: o'lcham asosida — planshetlar (≥768px) ruxsat etilgan.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
