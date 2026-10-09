import crypto from 'crypto';

// Imzolangan, qisqa-muddatli (signed) verification media URL — H-07 / P1-1 / P1-2.
//
// Pasport/selfie rasmlari endi OMMAVIY `/uploads/verifications/*` yoki R2 public
// domen orqali ochilmaydi. O'rniga moderator/owner tekshirilgan endpoint qisqa
// muddatli `?uid=&exp=&sig=` URL beradi. Imzo payloadi EGASI (userId) + OBYEKTKALITIG'I
// (object key) + muddat + scope'ni bog'laydi — shunda boshqa foydalanuvchi
// faylining nomini bilib o'z arizasiga ulay olmaydi (server-side ownership).
//
// P2-1: HECH QANDAY repo' ichida ko'rinadigan fallback secret ishlatilmaydi.
// Kalit = VERIFICATION_MEDIA_SECRET yoki JWT_SECRET. Ikkalasi ham bo'lmasa,
// signing O'CHIQ (fail-closed) — imzolangan link yaratilmaydi. Ochiq muhitda
// JWT_SECRET allaqachon majburiy (auth fail-fast), shuning uchun bu amalda
// faqat noto'g'ri lokal ishga tushirishda funksiyani o'chiradi.
const SECRET = (process.env.VERIFICATION_MEDIA_SECRET || process.env.JWT_SECRET || '').trim();

/** Verification-media imzolash yoqilganmi? Secret bo'lmasa — yo'q. */
export const MEDIA_SIGNING_ENABLED = SECRET.length >= 16;

const SCOPE = 'verify-doc';

function computeSig(userId: string, key: string, exp: number): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${SCOPE}:${userId}:${key}:${exp}`)
    .digest('hex');
}

/**
 * Bir verification obyekti uchun imzolangan, TTL muddatli ko'rish URL'i.
 * `key` — ob'ekt bazasi (masalan `1700000000-ab12cd34.webp`), `userId` — fayl egasi.
 * Secret sozlanmagan bo'lsa `null` qaytaradi (funksiya o'chirilgan).
 */
export function signVerificationPhotoUrl(key: string, userId: string, ttlSec = 180): string | null {
  if (!MEDIA_SIGNING_ENABLED || !key || !userId) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = computeSig(userId, key, exp);
  return `/api/verification-photo/${encodeURIComponent(key)}?uid=${encodeURIComponent(userId)}&exp=${exp}&sig=${sig}`;
}

/** Imzo, muddat va egani vaqtga-mustahkam (timing-safe) tekshiradi. */
export function verifyVerificationPhotoSig(
  key: string,
  userId: unknown,
  exp: unknown,
  sig: unknown
): boolean {
  if (!MEDIA_SIGNING_ENABLED) return false;
  const uid = typeof userId === 'string' ? userId : '';
  if (!key || !uid) return false;
  const expN = Number(exp);
  const provided = typeof sig === 'string' ? sig : '';
  const expected = computeSig(uid, key, Number.isFinite(expN) ? expN : 0);
  if (!Number.isFinite(expN) || expN < Math.floor(Date.now() / 1000)) return false;
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
