import crypto from 'crypto';

// Imzolangan, qisqa-muddatli (signed) media URL — H-07 uchun.
// Pasport/selfie rasmlari endi OMMAVIY `/uploads/verifications/*` orqali
// ochilmaydi; o'rniga moderator/owner auth Tekshirilgan list endpoint qisqa
// muddatli `?exp=&sig=` URL beradi. `<img>` shu signed URL'ni ishlatadi (Bearer
// kerak emas, chunki ruxsat sig'da). Sig JWT_SECRET bilan HMAC-SHA256.
const SECRET =
  process.env.JWT_SECRET || 'tophand-dev-insecure-secret-do-not-use-in-prod';

const SCOPE = 'verify-doc';

function computeSig(filename: string, exp: number): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${SCOPE}:${filename}:${exp}`)
    .digest('hex');
}

/** Bir fayl nomi uchun imzolangan, TTL muddatli ko'rish URL'i. */
export function signVerificationPhotoUrl(filename: string, ttlSec = 180): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = computeSig(filename, exp);
  return `/api/verification-photo/${encodeURIComponent(filename)}?exp=${exp}&sig=${sig}`;
}

/** Imzoni va muddatini vaqtga-mustahkam (timing-safe) tekshiradi. */
export function verifyVerificationPhotoSig(filename: string, exp: unknown, sig: unknown): boolean {
  const expN = Number(exp);
  const provided = typeof sig === 'string' ? sig : '';
  const expected = computeSig(filename, Number.isFinite(expN) ? expN : 0);
  if (!Number.isFinite(expN) || expN < Math.floor(Date.now() / 1000)) return false;
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
