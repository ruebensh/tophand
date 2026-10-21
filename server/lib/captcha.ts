// ============================================================================
//  captcha.ts — server-side bot-himoya (Cloudflare Turnstile), ENV-GEKILOVCHI.
//  Hisob kaliti (.env: TURNSTILE_SECRET_KEY) qo'yilmaganda funksiya NO-OP
//  qaytadi (`enabled:false`) — ya'ni lokal/test muhitida hech narsa buzilmaydi
//  va e'lon joylash captcha talab qilmaydi. Kalit o'rnatilganda esa token
//  majburiy tekshiriladi. Maxfiy sir (secret) HEC QACHON klientga qaytarilmaydi.
// ============================================================================

export interface CaptchaResult {
  enabled: boolean;
  ok: boolean;
  error?: string;
}

/** So'rovni Cloudflare siteverify endpointi orqali tasdiqlaydi. */
export async function verifyCaptcha(token: unknown, remoteIp?: string): Promise<CaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Konfiguratsiya qilinmagan — xususiyat O'FIQ (no-op), tekshiruv o'tkazib yuboriladi.
  if (!secret) return { enabled: false, ok: true };

  const response = typeof token === 'string' ? token.trim() : '';
  if (!response) {
    return { enabled: true, ok: false, error: 'Captcha tasdiqnamasi keltirilmagan' };
  }

  try {
    const body = new URLSearchParams({ secret, response });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    if (data.success) return { enabled: true, ok: true };
    return { enabled: true, ok: false, error: 'Captcha tasdiqlanmadi (qayta urinib ko\'ring)' };
  } catch {
    // Fail-closed: tarmoq xatosida tasdiqni rad etamiz (spamdan himoya maqsadi).
    return { enabled: true, ok: false, error: 'Captcha xizmatiga bog\'lanib bo\'lmadi' };
  }
}

/** Klientga ko'rsatiladigan OCHIQCASGA sitekey (secret EMAS). Yo'q bo'lsa null. */
export function getTurnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITEKEY || null;
}
