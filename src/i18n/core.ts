// ============================================================================
//  i18n CORE — lug'atlarni yuklaydi, faol lugalni saqlaydi va tarjima
//  funksiyalarini beradi. React'dan mustaqil, shuning uchun oddiy util
//  funksiyalar (utils.ts) ham tarjimadan foydalana oladi.
// ----------------------------------------------------------------------------
//  Faol lugal React'dagi IntlProvider tomonidan setActiveLocale() orqali
//  yangilanadi; bu yerda sukut 'uz'.
// ============================================================================

import uz from './locales/uz.ts';
import ru from './locales/ru.ts';
import en from './locales/en.ts';
import { uzLatnToCyrillic } from './translit.ts';

export type Locale = 'uz' | 'uz-Cyrl' | 'ru' | 'en';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'uz', label: "O'zbekcha" },
  { id: 'uz-Cyrl', label: 'Ўзбекча' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

export const STORAGE_KEY = 'th_lang';
const VALID: Locale[] = ['uz', 'uz-Cyrl', 'ru', 'en'];

type Dict = Record<string, any>;
const DICTS: Record<'uz' | 'ru' | 'en', Dict> = { uz, ru, en };

export const INTL_LOCALE: Record<Locale, string> = {
  uz: 'uz-UZ',
  'uz-Cyrl': 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

let _active: Locale = 'uz';
export function setActiveLocale(l: Locale): void {
  _active = l;
}
export function getActiveLocale(): Locale {
  return _active;
}

function lookup(dict: Dict, path: string): string | undefined {
  const val = path.split('.').reduce<any>((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
  return typeof val === 'string' ? val : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{{${k}}}`));
}

/** Kalit bo'yicha tarjima (hook'siz). uz-Cyrl → transliteratsiya. */
export function translate(key: string, vars?: Record<string, string | number>, locale: Locale = _active): string {
  const base: 'uz' | 'ru' | 'en' = locale === 'uz-Cyrl' ? 'uz' : locale;
  const raw = lookup(DICTS[base], key) ?? lookup(DICTS.uz, key) ?? key;
  const filled = interpolate(raw, vars);
  return locale === 'uz-Cyrl' ? uzLatnToCyrillic(filled) : filled;
}

/** Bazadagi obyekt (name_uz / name_ru / name_en) dan tilga mos nom. */
export function localizeName(
  obj: Record<string, any> | null | undefined,
  baseName = 'name',
  locale: Locale = _active,
): string {
  if (!obj) return '';
  const uzVal: string = obj[`${baseName}_uz`] ?? obj[baseName] ?? '';
  let val: string;
  if (locale === 'ru') val = obj[`${baseName}_ru`] || uzVal;
  else if (locale === 'en') val = obj[`${baseName}_en`] || uzVal;
  else val = uzVal;
  return locale === 'uz-Cyrl' ? uzLatnToCyrillic(val) : val;
}

/** localStorage / brauzerdan boshlang'ich lugalni aniqlaydi. */
export function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'uz';
  const n = nav.toLowerCase();
  if (n.startsWith('ru')) return 'ru';
  if (n.startsWith('en')) return 'en';
  return 'uz';
}
