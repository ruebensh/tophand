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

export interface TypewriterState {
  /** Faol — so'zlar yuklangan, overlay ko'rsatiladi (placeholder attribute bo'sh) */
  active: boolean;
  /** Hozirgi yozilgan matn (kursor belgisisiz — kursor DOM-element bilan chiziladi) */
  text: string;
  /** Haqqiqiy kursor miltillashi uchun: faqat so'z tugab TO'XTAGANDA true */
  idle: boolean;
}

/**
 * Topbar qidiruv uchun "typewriter" holati: eng ko'p qidirilgan so'zlarni
 * harfma-harf yozadi → to'xtaydi (idle=true — kursor miltillaydi) → qayta
 * yozib-o'chirib loop qiladi.
 *
 * Kursor endi MATN EMAS — Header uni alohida DOM-bar (2px, baland, ko'k)
 * sifatida chizadi, shuning uchun haqiqiy klaviatura kursoridek ko'rinadi.
 *
 * Optimizatsiya: har tick = 1 setState; tab yashiringanida sikl to'xtaydi;
 * so'zlar modul keshida — network bir marta.
 */
export function useTypewriterPlaceholder(): TypewriterState {
  const [words, setWords] = useState<string[]>(cachedWords || []);
  const [typed, setTyped] = useState('');
  const [idle, setIdle] = useState(false);

  // So'zlarni bir marta yuklab olish
  useEffect(() => {
    let alive = true;
    if (!cachedWords) {
      loadTopKeywords().then((w) => { if (alive && w.length) setWords(w); });
    } else if (!words.length) {
      setWords(cachedWords);
    }
    return () => { alive = false; };
  }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

  // Typewriter sikli: type (doim yoniq) → hold (idle — kursor miltillaydi) → delete
  useEffect(() => {
    if (!words.length) { setTyped(''); setIdle(false); return; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let wordIdx = 0;
    let charIdx = 0;
    let blinkCount = 0;
    let phase: 'type' | 'hold' | 'delete' = 'type';

    const tick = () => {
      if (stopped) return;
      // Ko'rinmas tab — 1 sekunddan keyin qayta tekshirish (sarfsiz)
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(tick, 1000);
        return;
      }
      const w = words[wordIdx % words.length];
      switch (phase) {
        case 'type':
          setIdle(false);
          charIdx++;
          setTyped(w.slice(0, charIdx));
          if (charIdx >= w.length) {
            phase = 'hold';
            blinkCount = 0;
            setIdle(true); // so'z tugadi — kursor endi miltillaydi
            timer = setTimeout(tick, 1600);
          } else {
            timer = setTimeout(tick, 75);
          }
          break;
        case 'hold':
          // Miltillash faqat SHU fazada (idle) — CSS animatsiya o'zi boshqaradi
          setIdle(true);
          blinkCount++;
          if (blinkCount >= 4) {
            phase = 'delete';
            setIdle(false);
            timer = setTimeout(tick, 260);
          } else {
            timer = setTimeout(tick, 430);
          }
          break;
        case 'delete':
          setIdle(false);
          charIdx--;
          setTyped(w.slice(0, charIdx));
          if (charIdx <= 0) {
            phase = 'type';
            wordIdx++;
            timer = setTimeout(tick, 380);
          } else {
            timer = setTimeout(tick, 32);
          }
          break;
      }
    };

    timer = setTimeout(tick, 500);
    return () => { stopped = true; clearTimeout(timer); setIdle(false); };
  }, [words]);

  return { active: words.length > 0, text: typed, idle };
}
