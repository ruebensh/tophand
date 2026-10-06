// ============================================================================
//  useTranslate — foydalanuvchi kontentini (e'lon, izoh, org tavsifi) joriy
//  tilga moslashtiradi:
//    uz      → asl matn
//    uz-Cyrl → asl (lotin) matndan transliteratsiya (API kerak emas)
//    ru/en   → mashina-tarjimasi (kesh + batch), xatolikda asl matn
// ============================================================================

import { useEffect, useState } from 'react';
import { useI18n } from './IntlContext.tsx';
import { requestTranslation } from './translateClient.ts';
import { uzLatnToCyrillic } from './translit.ts';

export interface UseTranslateResult {
  value: string;
  loading: boolean;
}

export function useTranslate(
  text: string | null | undefined,
  enabled = true
): UseTranslateResult {
  const { locale } = useI18n();
  const original = text ?? '';
  const target: 'ru' | 'en' | null =
    enabled && (locale === 'ru' || locale === 'en') ? locale : null;

  const derive = (): string => {
    if (!enabled) return original;
    if (locale === 'uz-Cyrl') return uzLatnToCyrillic(original);
    return original; // ru/en — MT tugaguncha asl matn ko'rsatiladi
  };

  const [value, setValue] = useState<string>(derive);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      setValue(original);
      setLoading(false);
      return;
    }
    if (locale === 'uz-Cyrl') {
      setValue(uzLatnToCyrillic(original));
      setLoading(false);
      return;
    }
    if (!target || original.trim() === '') {
      setValue(original);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    requestTranslation(original, target)
      .then((t) => {
        if (!alive) return;
        setValue(t || original);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setValue(original);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [original, locale, target, enabled]);

  return { value, loading };
}

export default useTranslate;
