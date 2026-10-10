import { Response } from 'express';

/**
 * SECURITY (M-14 / F-10): xatolikni server logiga yozamiz, lekin mijozga faqat
 * xavfsiz xabarni qaytaramiz. 5xx xabarlar (DB/SQL/fayl tizimi/stack) HECH
 * QANDAY muhitda — LOCAL_DEV=1 da ham — SIZIB CHIQMAYDI (F-10: LOCAL_DEV
 * deployment guard'i xato matni sizdirish sababi bo'lmasin).
 * 4xx — ataylab, mijoz uchun yozilgan xabar, har doim ko'rsatiladi.
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
  const expose = status >= 400 && status < 500;
  res.status(status).json({
    error: expose ? (err?.message || fallback) : fallback,
  });
}
