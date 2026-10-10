// ─── Rate limiting (F-01 / F-02 / F-03) ─────────────────────────────────────
// Commit-62 findings yopilgan dizayn:
//  * Bucket KEY hech qachon client-controlled xom qiymatlardan tuzilmaydi:
//    - `Authorization` header hash'i OLIB TASHLANDI (attacker soxta bearer'lar
//      bilan cheksiz yangi bucket yaratar edi);
//    - `req.path` (dynamic ID'lar, query-travesty) OLIB TASHLANDI — o'rniga
//      limiter mount qilingan STATIK scope (`/api/auth`, `/api/wallet`, ...)
//      ishlatiladi. Bucket soni: scope × identity — chegaralangan.
//  * Identity: EXPOSED muhitda JWT signature'ini tekshirib tasdiqlangan
//    `userId` olinadi (imzolangan — qalblab bo'lmaydi); token yo'q/yaroqsiz
//    bo'lsa `req.ip`. LOCAL_DEV'da faqat IP (dev token'lari bucket'ni shovullamasin).
//  * Bounded store: maksimal kalit soni + muddati o'tgan kalitlarni tozalash.
//  * Multi-instance (Redis shared store) — infra tomoni; quyidagi interfeysga
//    mos istalgan store (`get`/`incr`) bilan kengaytirsa bo'ladi.

import type { Request, Response, NextFunction } from 'express';

export interface BucketStore {
  /** Kalitni 1 ga oshiradi; yangi kalitda window boshlanadi. */
  incr(key: string, windowMs: number, maxKeys: number): Promise<{ count: number; reset: number } | null>;
}

/**
 * Process-local bounded store. `maxKeys` chegarasi dolarbop: to'ldi bo'lsa
 * eski (reset bo'yicha eng kichik) kalitlar siqib chiqariladi — Map HECH
 * qachon cheksiz o'smaydi.
 */
export function memoryStore(): BucketStore & { size(): number } {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    incr(key, windowMs, maxKeys) {
      const now = Date.now();
      let rec = hits.get(key);
      if (!rec || now > rec.reset) {
        if (hits.size >= maxKeys) {
          // Evict expired first; still full → evict oldest-reset.
          let evicted = false;
          for (const [k, v] of hits) {
            if (now > v.reset) {
              hits.delete(k);
              evicted = true;
              if (hits.size < maxKeys) break;
            }
          }
          while (!evicted && hits.size >= maxKeys) {
            const oldest = hits.keys().next();
            if (oldest.done) break;
            hits.delete(oldest.value);
            evicted = true;
          }
        }
        rec = { count: 0, reset: now + windowMs };
        hits.set(key, rec);
      }
      rec.count++;
      return Promise.resolve(rec);
    },
    size() {
      return hits.size;
    },
  };
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  /** Limiter'ga statik bag'langan scope (masalan '/api/auth'). */
  scope: string;
  /**
   * (req) → bucket identity. NATIJAGA `scope` qo'shiladi. Bu funksiya
   * client-controlled xom qiymatlarni QAYTA QAYTARMASTI (fallback IP).
   */
  identity(req: Request): string;
  store?: BucketStore;
}

export function buildRateLimit(opts: RateLimitOptions) {
  const store = opts.store || memoryStore();
  const MAX_KEYS = 100_000;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `${opts.scope}|${opts.identity(req)}`;
      const rec = await store.incr(key, opts.windowMs, MAX_KEYS);
      if (!rec) return next();
      if (rec.count > opts.max) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rec.reset - Date.now()) / 1000))));
        return res.status(429).json({ error: opts.message });
      }
      next();
    } catch (err) {
      // Store xatosi limitni bloklamasin — fail-open emas, log bilan o'tkazamiz
      // (availability), lekin xato ko'rinib tursin.
      console.error('[rateLimit] store error:', err);
      next();
    }
  };
}

/**
 * F-03: `trust proxy` deployment topologiyasiga mos kelishi SHART.
 *   - default `1` — bitta ishonchli reverse proxy (Cloudflare→Render zanjiri
 *     EMAS; bunday holatda TRUST_PROXY=2 qo'ying);
 *   - `0`/`false`/`direct` — proxy sarlavhalariga umuman ishonilmaydi
 *     (bevosita exposure uchun xavfsiz);
 *   - boshqa qiymat — Express'ning o'z validatsiyasiga uzatiladi (CIDR ro'yxati,
 *     function va h.k.). Noto'g'ri qiymatda Express FAIL qiladi — bu xohlangan
 *     xatti-harakat (noto'g'ri topologiya sekin buzilmasin).
 */
export function resolveTrustProxy(raw: string | undefined): boolean | number | string {
  const value = (raw ?? '1').trim();
  if (value === '0' || value === 'false' || value.toLowerCase() === 'direct') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value; // 'true' | CIDR ro'yxati | funksiya nomi emas — Express tekshiradi
}
