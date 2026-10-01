// ─── Mavzu naqshlari va bayram animatsiyalari kutubxonasi ───────────────
// 14 hududning madaniy naqshlari (SVG data-URI) + bayram effektlari ro'yxati.
// Naqshlar hudud aksent rangi bilan bo'yaladi, shuning uchun har bir hudud
// o'ziga xos ko'rinishga ega bo'ladi (kartalar foni va sahifa muhiti uchun).

export type PatternKey = 'girih' | 'suzani' | 'islimi' | 'turkum' | 'plain';
export type EffectKey = 'none' | 'snow' | 'flagStars' | 'petals' | 'fireworks' | 'sparkle';

// SVG'ni CSS `url(...)` qiymatiga aylantiradi.
function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;
}

// 8 like girih yulduzi + kvadrat panjarasi (Sharq me'morchiligi).
function girih(c: string, o: number): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.2'><path d='M28 3 L36 20 L53 28 L36 36 L28 53 L20 36 L3 28 L20 20 Z'/><rect x='14' y='14' width='28' height='28'/><rect x='14' y='14' width='28' height='28' transform='rotate(45 28 28)'/></g></svg>`;
}

// Suzani gul-rozetkasi (8 toj + halqa).
function suzani(c: string, o: number): string {
  let petals = '';
  for (let i = 0; i < 8; i++) {
    petals += `<ellipse cx='30' cy='14' rx='4' ry='9' transform='rotate(${i * 45} 30 30)'/>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.2'><circle cx='30' cy='30' r='5'/>${petals}<circle cx='30' cy='30' r='17'/></g></svg>`;
}

// Islimiy — o'simlik sopoq va barglari (to'lqinli chiziq).
function islimi(c: string, o: number): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='40' viewBox='0 0 64 40'><g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.2'><path d='M0 20 Q16 2 32 20 T64 20'/><path d='M16 12 q6 -6 10 0 q-6 6 -10 0'/><path d='M40 28 q6 -6 10 0 q-6 6 -10 0'/></g></svg>`;
}

// Turkum — rombs (brilliant) panjara naqshi.
function turkum(c: string, o: number): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.1'><path d='M24 2 L46 24 L24 46 L2 24 Z'/><path d='M24 12 L36 24 L24 36 L12 24 Z'/></g></svg>`;
}

/** Kartalar ichidagi nozik takrorlanuvchi naqsh (fon suvi). */
export function getCardPattern(key: PatternKey | undefined, color: string): string {
  switch (key) {
    case 'girih': return svgUrl(girih(color, 0.10));
    case 'suzani': return svgUrl(suzani(color, 0.10));
    case 'islimi': return svgUrl(islimi(color, 0.10));
    case 'turkum': return svgUrl(turkum(color, 0.10));
    default: return 'none';
  }
}

/** Sahifa muhitidagi yirik, juda nozik naqsh qatlami. */
export function getAtmosphereOrnament(key: PatternKey | undefined, color: string): string {
  switch (key) {
    case 'girih': return svgUrl(girih(color, 0.06));
    case 'suzani': return svgUrl(suzani(color, 0.06));
    case 'islimi': return svgUrl(islimi(color, 0.06));
    case 'turkum': return svgUrl(turkum(color, 0.06));
    default: return 'none';
  }
}

// ─── Hudud → naqsh xaritasi (14 ta) ─────────────────────────────────────
export const REGION_PATTERN: Record<string, PatternKey> = {
  reg_toshkent_sh: 'girih',
  reg_toshkent: 'islimi',
  reg_samarqand: 'girih',
  reg_fargona: 'suzani',
  reg_andijon: 'suzani',
  reg_namangan: 'islimi',
  reg_buxoro: 'girih',
  reg_xorazm: 'girih',
  reg_qashqadaryo: 'turkum',
  reg_surxondaryo: 'turkum',
  reg_jizzax: 'islimi',
  reg_sirdaryo: 'suzani',
  reg_navoiy: 'girih',
  reg_qoraqalpogiston: 'turkum',
};

export const PATTERN_OPTIONS: { key: PatternKey; label: string }[] = [
  { key: 'girih', label: 'Girih (8 lik yulduz)' },
  { key: 'suzani', label: 'Suzani (gul-rozetka)' },
  { key: 'islimi', label: 'Islimiy (sopoq-barg)' },
  { key: 'turkum', label: 'Turkum (rombs)' },
  { key: 'plain', label: 'Naqshsiz' },
];

// ─── Bayram → animatsiya xaritasi ───────────────────────────────────────
export const HOLIDAY_EFFECT: Record<string, EffectKey> = {
  yangi_yil: 'snow',
  xollara: 'petals',
  navroz: 'petals',
  xotira: 'sparkle',
  mustaqillik: 'flagStars',
  konstitutsiya: 'fireworks',
  ramazon_hayit: 'sparkle',
  qurbon_hayit: 'sparkle',
};

export const EFFECT_OPTIONS: { key: EffectKey; label: string }[] = [
  { key: 'none', label: 'Yo‘q' },
  { key: 'snow', label: '❄️ Qor + yangi yil chiroqlari' },
  { key: 'flagStars', label: '🇺 Rangli yulduzlar → bayroq' },
  { key: 'petals', label: '🌸 Gullar / barglar' },
  { key: 'fireworks', label: '🎆 Fayerverk' },
  { key: 'sparkle', label: '✨ Miltillosan yulduzchalar' },
];
