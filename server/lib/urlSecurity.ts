/**
 * URL xavfsizligi: foydalanuvchi kiritgan URL'larni tozalash.
 *
 * Maqsad — `javascript:`, `data:`, `file:`, `vbscript:` va protocol-relative
 * (`//host`) kabi XSS / fishing vektorlarini saqlashdan oldin bloklaymiz.
 * Ruxsat etilgan:
 *   - sayt ichidagi nisbiy yo'llar:  /uploads/..., /api/..., /images/...  (lekin //emas)
 *   - to'liq http/https absolute URL'lar (R2, tashqi rasm/video)
 *
 * qaytadi: tozalangan string yoki (yaroqsiz bo'lsa) null.
 */
export function sanitizeUserUrl(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Saytimizga nisbiy yo'l — xavfsiz, lekin `//host` (protocol-relative) ni rad etamiz.
  if (raw.startsWith('/')) {
    if (raw.startsWith('//')) return null;
    // `/\` va `..` traveralini ham yo'l qo'ymaymiz (bu fayl tizimiga emas, lekin keraksiz).
    if (/\\/.test(raw)) return null;
    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null; // sxemasiz / noto'g'ri URL
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null; // javascript:, data:, file:, vb.
  }
  return parsed.toString();
}

/**
 * URL ro'yxatini tozalaydi (listing media kabi). Noto'g'ri qiymatlar tushirib
 * qoldiriladi; `max` bilan cheklanadi (resource exhaustion oldini olish).
 */
export function sanitizeUserUrlList(values: unknown, max = 20): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const u = sanitizeUserUrl(v);
    if (u) {
      out.push(u);
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * `website`/`site_url` kabi maydonlar uchun yumshoq variant: foydalanuvchi
 * sxemasiz domen kiritsa (`tophand.uz`) `https://` qo'shamiz, so'ng qat'iy
 * tekshiramiz. `javascript:`/`data:`/`file:` baribir rad etiladi.
 */
export function sanitizeUserUrlLoose(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // sxemasiz, slash bilan boshlanmagan, nuqta va harfliy TLD'ga o'xshash → https://
  if (!/^[a-zA-Z][a-zA-Z0-9+.:-]*:\/\//.test(raw) && !raw.startsWith('/') && /^[\w.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(raw)) {
    return sanitizeUserUrl(`https://${raw}`);
  }
  return sanitizeUserUrl(raw);
}
