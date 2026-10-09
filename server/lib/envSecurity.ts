/**
 * Muhit xavfsizligi — fail-closed uchun yagona manba.
 *
 * Xavfsiz default: agar muhit "internetga ochiq" bo'lsa (staging/preview/
 * production yoki NODE_ENV umuman belgilanmagan), barcha demo/fallback yo'llari
 * YOPIQ bo'ladi. Mahalliy ishlab chiqishga ruxsat faqat ANIQ signallar bilan:
 *   - LOCAL_DEV=1  (dev npm-skript o'zi qo'yadi; deploy start'iga tegmaydi)
 *   - NODE_ENV=development | test
 *
 * Eski xato: `NODE_ENV` belgilanmagan holat "local dev" deb hisoblanar edi —
 * endi belgilanmagan = EXPOSED (xavfsiz).
 */
const NODE_ENV = process.env.NODE_ENV;

/** Faqat explicit LOCAL_DEV=1. Deploy `npm run start`/prod bunday qo'ymaydi. */
export const LOCAL_DEV = process.env.LOCAL_DEV === '1';

/** Xavfsiz bo'lmagan lokal/test fallback ruxsat etiladimi? */
export const INSECURE_ALLOWED =
  LOCAL_DEV || NODE_ENV === 'development' || NODE_ENV === 'test';

/** Aniq production. */
export const IS_PROD = NODE_ENV === 'production';

/** Internetga ochiq hisoblanamiz (fallback taqiqlanadi). */
export const EXPOSED = !INSECURE_ALLOWED;
