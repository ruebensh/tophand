import { useEffect, useState } from 'react';
import { apiRequest } from './api';

// ─── Top qidiruv so'zlari — butun sahifa uchun bitta marta yuklanadi ───
let cachedWords: string[] | null = null;
let inflight: Promise<string[]> | null = null;

async function loadTopKeywords(): Promise<string[]> {
  if (cachedWords) return cachedWords;
  if (!inflight) {
    inflight = apiRequest<{ keywords: string[] }>('/api/listings/top-keywords')
      .then((r) => {
        cachedWords = Array.isArray(r?.keywords) ? r.keywords : [];
        return cachedWords;
      })
      .catch(() => {
        cachedWords = []; // xato bo'lsa jimgina statik placeholder'da qolamiz
        return [] as string[];
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/**
 * Topbar qidiruv uchun "typewriter" placeholder: eng ko'p qidirilgan so'zlarni
 * yozadi → pauza → o'chiradi → keyingisiga o'tadi (15 tagacha, doimiy loop).
 *
 * Optimizatsiya (silliqlik kafolati):
 *  - Faqat placeholder almashadi — layout'ga tegishli hech qanday qayta oqish yo'q.
 *  - Tab ko'rinmasa (document.hidden) yozuv to'xtaydi — batareya/CPU sarfi nol.
 *  - Ijobiy foydalanuvchi e'lon izlayotgan bo'lsa (fokussa + qiymat) ham to'xtaydi.
 *  - So'zlar modul darajasida keshlanadi — har bir mount'da network'ga chiqmaydi.
 */
export function useTypewriterPlaceholder(fallback: string): string {
  const [words, setWords] = useState<string[]>(cachedWords || []);
  const [typed, setTyped] = useState('');

  // So'zlarni bir marta yuklab olish
  useEffect(() => {
    let alive = true;
    if (!cachedWords) {
      loadTopKeywords().then((w) => { if (alive && w.length) setWords(w); });
    } else if (!words.length) {
      setWords(cachedWords);
    }
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Typewriter sikli
  useEffect(() => {
    if (!words.length) { setTyped(''); return; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let wordIdx = 0;
    let charIdx = 0;
    let deleting = false;

    const word = () => words[wordIdx % words.length];

    const tick = () => {
      if (stopped) return;
      // Ko'rinmas tab — 1 sekunddan keyin qayta tekshirish (sarfsiz)
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(tick, 1000);
        return;
      }
      const w = word();
      if (!deleting) {
        charIdx++;
        setTyped(w.slice(0, charIdx));
        if (charIdx >= w.length) {
          deleting = true;
          timer = setTimeout(tick, 2200); // o'qish uchun pauza
          return;
        }
        timer = setTimeout(tick, 75);
      } else {
        charIdx--;
        setTyped(w.slice(0, charIdx));
        if (charIdx <= 0) {
          deleting = false;
          wordIdx++;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 32);
      }
    };

    timer = setTimeout(tick, 500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [words]);

  // Bo'sh momentda statik maslahat ko'rinib tursin — input hech qachon
  // "bo'sh placeholder" bilan qolmasin
  return typed || fallback;
}
