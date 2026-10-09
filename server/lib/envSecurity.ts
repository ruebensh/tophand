/**
 * Muhit xavfsizligi — fail-closed uchun yagona manba.
 *
 * Xavfsiz default: agar muhit "internetga ochiq" bo'lsa (staging/preview/
 * production yoki NODE_ENV umuman belgilanmagan), barcha demo/fallback yo'llari
 * YOPIQ bo'ladi. Xavfsiz bo'lmagan lokal fallbackga ruxsat FAQAT aniq lokal
 * opt-in bilan:
 *   - LOCAL_DEV=1  (dev npm-skript o'zi qo'yadi; deploy start'iga tegmaydi)
 *
 * Eski xatolar (tuzatildi):
 *   - `NODE_ENV` belgilanmagan holat "local dev" deb hisoblanar edi — endi
 *     belgilanmagan = EXPOSED (xavfsiz).
 *   - `NODE_ENV=development|test` o'zi JWT fallback / demo OTP / demo wallet'ni
 *     yoqar edi — endi yoqmaydi. Testlar tasodifiy secret/mock bilan ishlaydi va
 *     ochiq server sifatida tushmaydi. Runtime'da xavfsiz bo'lmagan rejimga
 *     ruxsat faqat LOCAL_DEV=1.
 */
const NODE_ENV = process.env.NODE_ENV;

/** Faqat explicit LOCAL_DEV=1. Deploy `npm run start`/prod/staging bunday qo'ymaydi. */
export const LOCAL_DEV = process.env.LOCAL_DEV === '1';

/** Xavfsiz bo'lmagan lokal fallback ruxsat etiladimi? FAQAT LOCAL_DEV=1. */
export const INSECURE_ALLOWED = LOCAL_DEV;

/** Aniq production. */
export const IS_PROD = NODE_ENV === 'production';

/** Internetga ochiq hisoblanamiz (fallback taqiqlanadi). */
export const EXPOSED = !INSECURE_ALLOWED;
