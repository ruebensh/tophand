// ─── Hudud mavzulari (14 ta O'zbekiston hududi) ────────────────────────
// GPS hududni aniqlaganda sayt uslubini shu hudud ruhiga moslashtiramiz.
// Token-asosli: aksent rang + gradient + madaniy motif + naqsh + fon rasmlari.

import { REGION_PATTERN, type PatternKey } from './themePatterns.ts';

export interface RegionTheme {
  /** HUDUD aksent rangi (tugmalar/badge/ribbon uchun) */
  accent: string;
  /** Aksentning yorug' fon varianti (chip, hover) */
  accentSoft: string;
  /** Hudud nomi (qisqa, badge uchun) */
  badge: string;
  /** Madaniy motif — kichik ko'zga tashlanarli belgi */
  motif: string;
  /** Yuqoridagi aksentdan gradient (hero/ribbon) */
  gradient: string;
  /** Admin yuklaydigan hero rasmi (eski maydon, backgrounds[0] bilan sinxron) */
  hero_image_url?: string;
  /** Madaniy naqsh turi (kartalar va muhit uchun) */
  pattern?: PatternKey;
  /** Admin yuklaydigan fon rasmlari (bir nechta — muhit almashinadi) */
  backgrounds?: string[];
}

// Standart brend mavzusi (hudud topilmasa / "Butun O'zbekiston")
export const DEFAULT_THEME: RegionTheme = {
  accent: '#1673E6',
  accentSoft: '#EAF2FE',
  badge: "Butun O'zbekiston",
  motif: '🇺🇿',
  gradient: 'linear-gradient(135deg, #1673E6 0%, #125FD0 100%)',
  hero_image_url: '',
  pattern: 'plain',
  backgrounds: [],
};

// 14 ta hudud — ID'lar server/db/init.ts dagi reg_* bilan bir xil.
export const REGION_THEMES: Record<string, RegionTheme> = {
  reg_toshkent_sh: {
    accent: '#1673E6', accentSoft: '#E6EFFE', badge: 'Toshkent shahri', motif: '🏙️',
    gradient: 'linear-gradient(135deg, #1673E6 0%, #2AA7F0 100%)',
  },
  reg_toshkent: {
    accent: '#2E7D57', accentSoft: '#E6F4EC', badge: 'Toshkent viloyati', motif: '🌳',
    gradient: 'linear-gradient(135deg, #2E7D57 0%, #4CA77A 100%)',
  },
  reg_samarqand: {
    accent: '#0E7C86', accentSoft: '#E2F4F5', badge: 'Samarqand', motif: '🕌',
    gradient: 'linear-gradient(135deg, #0E7C86 0%, #16A6B0 100%)',
  },
  reg_fargona: {
    accent: '#3A7D44', accentSoft: '#E8F4E9', badge: "Farg'ona", motif: '🌾',
    gradient: 'linear-gradient(135deg, #3A7D44 0%, #63B06E 100%)',
  },
  reg_andijon: {
    accent: '#B23A48', accentSoft: '#FAE8EB', badge: 'Andijon', motif: '🍎',
    gradient: 'linear-gradient(135deg, #B23A48 0%, #D96A78 100%)',
  },
  reg_namangan: {
    accent: '#2F855A', accentSoft: '#E6F3EC', badge: 'Namangan', motif: '🏔️',
    gradient: 'linear-gradient(135deg, #2F855A 0%, #57B589 100%)',
  },
  reg_buxoro: {
    accent: '#A9761F', accentSoft: '#F6EFDD', badge: 'Buxoro', motif: '🧡',
    gradient: 'linear-gradient(135deg, #A9761F 0%, #D6A33A 100%)',
  },
  reg_xorazm: {
    accent: '#1781B5', accentSoft: '#E4F1F8', badge: 'Xorazm', motif: '🐎',
    gradient: 'linear-gradient(135deg, #1781B5 0%, #3FA9D6 100%)',
  },
  reg_qashqadaryo: {
    accent: '#C06016', accentSoft: '#FAEEE1', badge: 'Qashqadaryo', motif: '🟥',
    gradient: 'linear-gradient(135deg, #C06016 0%, #E88B3C 100%)',
  },
  reg_surxondaryo: {
    accent: '#D35400', accentSoft: '#FBEADB', badge: 'Surxondaryo', motif: '☀️',
    gradient: 'linear-gradient(135deg, #D35400 0%, #F5842F 100%)',
  },
  reg_jizzax: {
    accent: '#2C7DA0', accentSoft: '#E5F0F6', badge: 'Jizzax', motif: '🌄',
    gradient: 'linear-gradient(135deg, #2C7DA0 0%, #55A0C4 100%)',
  },
  reg_sirdaryo: {
    accent: '#16A085', accentSoft: '#E3F5F1', badge: 'Sirdaryo', motif: '💧',
    gradient: 'linear-gradient(135deg, #16A085 0%, #3CC5A8 100%)',
  },
  reg_navoiy: {
    accent: '#6D597A', accentSoft: '#EEE9F1', badge: 'Navoiy', motif: '⛏️',
    gradient: 'linear-gradient(135deg, #6D597A 0%, #9680A5 100%)',
  },
  reg_qoraqalpogiston: {
    accent: '#0AA5A5', accentSoft: '#E1F5F5', badge: "Qoraqalpog'iston", motif: '🌊',
    gradient: 'linear-gradient(135deg, #0AA5A5 0%, #2FCFCF 100%)',
  },
};

// Har bir hududga standart naqsh va bo'sh fonlar ro'yxatini beramiz.
for (const [id, t] of Object.entries(REGION_THEMES)) {
  if (!t.pattern) t.pattern = REGION_PATTERN[id] || 'plain';
  if (!t.backgrounds) t.backgrounds = [];
}

export function getRegionTheme(regionId?: string | null): RegionTheme | undefined {
  if (!regionId) return undefined;
  return REGION_THEMES[regionId];
}

// Admin/Server tomonida yuborilgan qo'shimcha/ozatilgan qiymatlarni birlashtiradi.
export function mergeRegionThemes(
  base: Record<string, RegionTheme>,
  patch: Record<string, Partial<RegionTheme>>
): Record<string, RegionTheme> {
  const out: Record<string, RegionTheme> = { ...base };
  for (const [id, p] of Object.entries(patch || {})) {
    out[id] = { ...(out[id] ?? DEFAULT_THEME), ...p } as RegionTheme;
  }
  return out;
}
