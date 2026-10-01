// ─── O'zbekiston bayramlari + mavzu oynasi ─────────────────────────────
import { HOLIDAY_EFFECT, type EffectKey } from './themePatterns.ts';
// Bayronga 3 kun oldin sayt bayram mavzusiga o'tadi, bayrandan 3 kun keyin
// hudud mavzusiga qaytadi. Doimiy (milodiy) bayramlar avtomatik yuriladi;
// oy taqvimidagi (Ramazon/Qurbon Hayit) sanalarini admin `date` bilan qo'yadi.

export interface HolidayDef {
  id: string;
  name: string;
  /** Doimiy bayram: oy (1-12) va kun */
  month?: number;
  day?: number;
  /** Oy taqvimi / aniq sana: 'YYYY-MM-DD' (admin har yili yangilaydi) */
  date?: string;
  accent: string;
  accentSoft: string;
  motif: string;
  gradient: string;
  /** Bayram animatsiyasi (qor, bayroq yulduzlari, ...) */
  effect?: EffectKey;
  /** Admin yuklaydigan fon rasmlari (ixtiyoriy) */
  backgrounds?: string[];
}

// Mavzu oynasi: bayrondan necha kun oldin/so'ng
export const HOLIDAY_WINDOW_DAYS = 3;

export const DEFAULT_HOLIDAYS: HolidayDef[] = [
  { id: 'yangi_yil', name: 'Yangi yil', month: 1, day: 1, accent: '#C0392B', accentSoft: '#F8E4E1', motif: '🎄', gradient: 'linear-gradient(135deg, #C0392B 0%, #2C3E50 100%)' },
  { id: 'xollara', name: 'Xalqaro xollalar bayrami', month: 3, day: 8, accent: '#E0568E', accentSoft: '#FBE6F0', motif: '🌸', gradient: 'linear-gradient(135deg, #E0568E 0%, #B03A6E 100%)' },
  { id: 'navroz', name: 'Navro\'z bayrami', month: 3, day: 21, accent: '#2E9E5B', accentSoft: '#E4F5EA', motif: '🌿', gradient: 'linear-gradient(135deg, #2E9E5B 0%, #6FCF97 100%)' },
  { id: 'xotira', name: 'Xotira va qadrlash kunlari', month: 5, day: 9, accent: '#C79A2A', accentSoft: '#F7EFD8', motif: '🎖️', gradient: 'linear-gradient(135deg, #C79A2A 0%, #8E6F16 100%)' },
  { id: 'mustaqillik', name: 'O\'zbekiston Mustaqilligi', month: 8, day: 31, accent: '#1B985B', accentSoft: '#E4F4EC', motif: '🇺🇿', gradient: 'linear-gradient(135deg, #1B985B 0%, #0E6B3E 100%)' },
  { id: 'konstitutsiya', name: 'Konstitutsiya kunlari', month: 12, day: 8, accent: '#1673E6', accentSoft: '#E6EFFE', motif: '📜', gradient: 'linear-gradient(135deg, #1673E6 0%, #0E4FA0 100%)' },
  // Oy taqvimidagi diniy bayramlar — sanani admin qo'yadi (date maydi)
  { id: 'ramazon_hayit', name: 'Ramazon Hayit', accent: '#6D4C9F', accentSoft: '#EDE7F5', motif: '🌙', gradient: 'linear-gradient(135deg, #6D4C9F 0%, #9B7FC7 100%)' },
  { id: 'qurbon_hayit', name: 'Qurbon Hayit', accent: '#4A7C2F', accentSoft: '#EAF2E1', motif: '🐑', gradient: 'linear-gradient(135deg, #4A7C2F 0%, #7CB150 100%)' },
];

// Har bir bayramga standart animatsiya effektini beramiz.
for (const h of DEFAULT_HOLIDAYS) {
  if (!h.effect) h.effect = HOLIDAY_EFFECT[h.id] || 'sparkle';
  if (!h.backgrounds) h.backgrounds = [];
}

// Bayramning yaqin (tekshiriladigan) yildagi voqealar sanasi.
function occurrencesFor(h: HolidayDef, today: Date): Date[] {
  const out: Date[] = [];
  if (h.date) {
    const d = new Date(h.date + 'T00:00:00');
    if (!isNaN(d.getTime())) out.push(d);
    return out;
  }
  if (h.month && h.day) {
    const y = today.getFullYear();
    for (const yy of [y - 1, y, y + 1]) {
      out.push(new Date(yy, h.month - 1, h.day));
    }
  }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Ayni paytda amal qiladigan bayramni qaytaradi (3 kun oldin / 3 kun keyin).
export function computeActiveHoliday(
  holidays: HolidayDef[],
  today: Date = new Date(),
  windowDays: number = HOLIDAY_WINDOW_DAYS
): HolidayDef | null {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  for (const h of holidays) {
    for (const occ of occurrencesFor(h, today)) {
      const diff = Math.round((t - occ.getTime()) / DAY_MS);
      if (diff >= -windowDays && diff <= windowDays) return h;
    }
  }
  return null;
}
