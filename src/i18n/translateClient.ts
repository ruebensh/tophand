// ============================================================================
//  translateClient — mijoz tarafi mashina-tarjimasi: memory-cache + batch.
//  Bir nechta `Translated` komponenti so'rovni bitta POST /api/translate ga
//  birlashtiradi (window ichida). Natijalar sessiya bo'yi xotirada saqlanadi.
// ============================================================================

import { translateTexts } from '../lib/api.ts';

type Target = 'ru' | 'en';

// target|matn → tarjima (memory). Ochiq saqlanadi, sessiya davomida.
const cache = new Map<string, string>();
const key = (t: Target, text: string) => `${t}|${text}`;

interface Pending {
  resolve: (v: string) => void;
}
// target → text → yig'ilgan waiting ro'yxatlari.
const queues: Record<Target, Map<string, Pending[]>> = {
  ru: new Map(),
  en: new Map(),
};
const timers: Record<Target, ReturnType<typeof setTimeout> | null> = { ru: null, en: null };

const BATCH_WINDOW_MS = 60;
const MAX_PER_REQUEST = 100;

function scheduleFlush(target: Target) {
  if (timers[target]) return;
  timers[target] = setTimeout(() => {
    timers[target] = null;
    void flush(target);
  }, BATCH_WINDOW_MS);
}

async function flush(target: Target) {
  const q = queues[target];
  if (q.size === 0) return;

  // Bir so'rovda MAX_PER_REQUEST tagacha matn.
  const entries = [...q.entries()].slice(0, MAX_PER_REQUEST);
  const texts = entries.map(([text]) => text);
  // Yuborilganlarni navbatdan olib tashlaymiz (qolganlari keyingi flush).
  for (const [text] of entries) q.delete(text);
  if (q.size > 0) scheduleFlush(target);

  try {
    const res = await translateTexts(texts, target);
    entries.forEach(([text, pendings], i) => {
      const translated = res.translations?.[i] ?? text;
      cache.set(key(target, text), translated);
      pendings.forEach((p) => p.resolve(translated));
    });
  } catch {
    // Xatolikda asl matnni qaytaramiz (graceful); cache'ga yozmaymiz — qayta urinish mumkin.
    entries.forEach(([text, pendings]) => pendings.forEach((p) => p.resolve(text)));
  }
}

/**
 * Bitta matnni `target` tiliga tarjima qilish uchun so'rov. Kesh/batch avtomatik.
 */
export function requestTranslation(text: string, target: Target): Promise<string> {
  const clean = text ?? '';
  if (clean.trim() === '') return Promise.resolve(clean);
  const ck = key(target, clean);
  const hit = cache.get(ck);
  if (hit != null) return Promise.resolve(hit);

  return new Promise<string>((resolve) => {
    const q = queues[target];
    const existing = q.get(clean);
    if (existing) {
      existing.push({ resolve });
    } else {
      q.set(clean, [{ resolve }]);
    }
    scheduleFlush(target);
  });
}

// Test/admin maqsadlari uchun keshni tozalash.
export function clearTranslationCache() {
  cache.clear();
}
