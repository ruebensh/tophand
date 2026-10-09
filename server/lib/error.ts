import { Response } from 'express';
import { EXPOSED } from './envSecurity.ts';

/**
 * SECURITY (M-14): xatolikni server logiga yozamiz, lekin mijozga faqat
 * xavfsiz xabarni qaytaramiz. Internetga ochiq muhitda (staging/preview/prod/
 * unset) ichki 5xx xabarlari (DB/SQL/fayl tizimi/stack) SIZIB CHIQMASLIGI uchun
 * umumiy matn qaytamiz. 4xx — ataylab, mijoz uchun yozilgan xabar, ko'rsatiladi.
 *
 * `err.status` bo'lsa shu status ishlatiladi (masalan validatsiya 400).
 */
export function serverError(
  res: Response,
  err: any,
  fallback = 'Serverda ichki xatolik yuz berdi'
): void {
  // eslint-disable-next-line no-console
  console.error(err);
  if (res.headersSent) return;
  const status: number = err?.status || 500;
  const expose = !EXPOSED || (status >= 400 && status < 500);
  res.status(status).json({
    error: expose ? (err?.message || fallback) : fallback,
  });
}
