import { useEffect, useState } from 'react';

// ─── Kuratsiya qilingan top qidiruv so'zlari ───
// Admin panel statistikasiga BEKOR qilinmaydi — har bir asosiy kategoriya
// bo'yicha foydalanuvchilar haqiqiy yozadigan eng kerakli so'zlar kodda
// belgilangan. Tartib muhim: xizmatlar → tovarlar → ish, aralash aylanadi.
export const CURATED_SEARCH_WORDS: string[] = [
  // Ustalar va uy xizmatlari
  'santexnik', 'elektrik', 'duradgor', 'ta\'mirchi', 'konditsioner o\'rnatish',
  'tozalash xizmati', 'enaga', 'bog\'bon',
  // Transport va yuk
  'gruzchik', 'evakuator', 'mashina yuvish', 'yuk tashish', 'taksi haydovchisi',
  // Go\'zallik va salomatlik
  'sochtarosh', 'manikyur', 'veterinar', 'massaj',
  // Texnika va tovarlar
  'telefon ta\'mirlash', 'noutbuk', 'smartfon', 'velosiped', 'mebel', 'shinalar',
  // Ta\'lim va biznes
  'repetitor', 'buxgalter', 'tarjimon', 'ovqat yetkazish', 'video suratga olish',
];

export interface TypewriterState {
  /** Faol — so'zlar har doim bor (statik ro'yxat), overlay ko'rsatiladi */
  active: boolean;
  /** Hozirgi yozilgan matn (kursor belgisisiz — kursor DOM-element bilan chiziladi) */
  text: string;
  /** Haqiqiy kursor miltillashi uchun: faqat so'z tugab TO'XTAGANDA true */
  idle: boolean;
}

/**
 * Topbar qidiruv uchun "typewriter" holati: kuratsiya qilingan so'zlarni
 * harfma-harf yozadi → to'xtaydi (idle=true — kursor miltillaydi) → qayta
 * yozib-o'chirib loop qiladi.
 *
 * Kursor — MATN EMAS, Header uni alohida DOM-bar (2px, baland, ko'k)
 * sifatida chizadi (th-caret), haqiqiy klaviatura kursoridek ko'rinadi.
 *
 * Optimizatsiya: har tick = 1 setState; tab yashiringanida sikl to'xtaydi;
 * network SO'ROVI YO'Q — ro'yxat kodda.
 */
export function useTypewriterPlaceholder(): TypewriterState {
  const [typed, setTyped] = useState('');
  const [idle, setIdle] = useState(false);

  // Typewriter sikli: type (doim yoniq) → hold (idle — kursor miltillaydi) → delete
  useEffect(() => {
    const words = CURATED_SEARCH_WORDS;
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
  }, []);

  return { active: true, text: typed, idle };
}
