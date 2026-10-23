import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { queryOne, runQuery } from '../db/database.ts';
import { INSECURE_ALLOWED } from '../lib/envSecurity.ts';

// SECURITY (H-02): never fall back to a known secret in a real deployment.
// We fail closed for ANY environment except an explicit local dev/test opt-in
// (LOCAL_DEV=1 or NODE_ENV=development|test). Bare/unset NODE_ENV is now treated
// as EXPOSED (secure) — previously it was wrongly treated as local dev, letting
// staging/preview/unlabelled deployments forge tokens with the fallback secret.
const nodeEnv = process.env.NODE_ENV;
const ALLOW_INSECURE_DEV = INSECURE_ALLOWED;
if (!process.env.JWT_SECRET) {
  if (!ALLOW_INSECURE_DEV) {
    throw new Error(
      `FATAL: JWT_SECRET muhit o'zgaruvchisi qo'yilmagan — bu muhitda (${nodeEnv || 'unset'}) ishga tushirish taqiqlanadi (fail-closed).`
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    '⚠️  JWT_SECRET topilmadi — LOCAL DEV fallback ishlatilmoqda. HECH QACHON deploy muhitida (staging/preview/production) shunday qoldirmang.'
  );
}
const JWT_SECRET = process.env.JWT_SECRET || 'tophand-dev-insecure-secret-do-not-use-in-prod';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export type Role = 'USER' | 'INTERN_MOD' | 'MODERATOR' | 'LEAD_MOD' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  telegram_id: string;
  telegram_username?: string;
  name: string;
  role: Role;
  is_banned: number;
  ban_type: 'NONE' | 'TEMPORARY' | 'PERMANENT';
  ban_reason?: string;
  ban_end_date?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Validates Telegram Login Widget payload using HMAC-SHA256 according to Telegram specs.
 * https://core.telegram.org/widgets/login
 */
export function verifyTelegramAuth(data: Record<string, any>): boolean {
  if (!TELEGRAM_BOT_TOKEN) {
    // Bot token sozlanmagan: simulyatsiyaga ruxsat FAQAT aniq LOCAL_DEV=1'da.
    // Ochiq muhitda (staging/preview/unset/production) bu fail-closed → false.
    return INSECURE_ALLOWED;
  }

  const { hash, ...dataToCheck } = data;
  if (!hash) return false;

  // Telegram spec: create SHA256 of bot token as secret key
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();

  // Create data-check-string
  const checkString = Object.keys(dataToCheck)
    .sort()
    .map((k) => `${k}=${dataToCheck[k]}`)
    .join('\n');

  const calculatedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  // Check auth_date not older than 24 hours
  const authDate = parseInt(dataToCheck.auth_date, 10);
  if (isNaN(authDate) || Date.now() / 1000 - authDate > 86400) {
    return false;
  }

  return calculatedHash === hash;
}

export function generateToken(user: { id: string; telegram_id?: string | null; role: string }): string {
  // SECURITY: privileged (admin) sessiyalar qisqa umrli ko'radi — token o'g'irlansa,
  // hujum oynasi 30 kun emas, 3 kun bilan cheklanadi.
  const privileged = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  return jwt.sign(
    {
      id: user.id,
      telegram_id: user.telegram_id || null,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: privileged ? '3d' : '30d' }
  );
}

/**
 * Step-up token: xavfli admin amallar (rol almashtirish, ob'ekt o'chirish) oldidan
 * parolni QAYTA tekshirib olinadigan 10 daqiqalik qisqa muddatli token. Asosiy
 * sessiyadan alohida — o'g'irlangan 30 kunlik token bilan bu amallar bajaryolmaydi.
 */
export function generateStepUpToken(user: { id: string; role: string }): string {
  return jwt.sign(
    { id: user.id, role: user.role, purpose: 'stepup' },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
}

/**
 * requireAuth UNDAN KEYIN ishlatiladi: xavfli yo'llarda so'rovda yashirin
 * `x-stepup` tokenini talab qiladi (maxsus purpose'li, shu foydalanuvchiga tegishli).
 */
export function requireStepUp(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers['x-stepup'];
  const token = typeof header === 'string' ? header : '';
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded?.purpose === 'stepup' && decoded.id === req.user?.id) {
      return next();
    }
  } catch {
    /* pastga tushadi — 401 */
  }
  return res.status(401).json({
    error: 'Bu xavfli amal uchun parolni qayta tasdiqlash talab qilinadi',
    stepup_required: true,
  });
}

export async function authenticateToken(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id) return null;

    const user = await queryOne<AuthUser>(
      'SELECT id, telegram_id, telegram_username, name, role, is_banned, ban_type, ban_reason, ban_end_date FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) return null;

    // F-09: muddati tugagan VAQTINCHA blokni atomik, shartli ko'taramiz.
    // Moderator race'ida (blok uzaytirilsa/PERMANENT qilinga) UPDATE 0 qator
    // ta'sir qiladi — qayta o'qigach ban holati saqlanib qolgan bo'lsa, token
    // berilmaydi (null → 403).
    if (user.is_banned && user.ban_type === 'TEMPORARY' && user.ban_end_date) {
      if (new Date(user.ban_end_date).getTime() < Date.now()) {
        const lifted = await runQuery(
          `UPDATE users SET is_banned = 0, ban_type = 'NONE', ban_reason = NULL, ban_end_date = NULL
           WHERE id = ? AND is_banned = 1 AND ban_type = 'TEMPORARY' AND ban_end_date <= NOW()`,
          [user.id]
        );
        if (lifted.changes > 0) {
          const fresh = await queryOne<AuthUser>(
            'SELECT id, telegram_id, telegram_username, name, role, is_banned, ban_type, ban_reason, ban_end_date FROM users WHERE id = ?',
            [user.id]
          );
          if (!fresh) return null;
          Object.assign(user, fresh);
        }
      }
    }

    // So'rov autentifikatsiyadan o'tmagan bo'lsa ham ban holati bilan uchmasin.
    if (user.is_banned) return null;

    return user;
  } catch (err) {
    return null;
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi (Token mavjud emas)' });
  }

  const token = authHeader.split(' ')[1];
  const user = await authenticateToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Yaroqsiz yoki muddati o‘tgan sessiya' });
  }

  if (user.is_banned) {
    return res.status(403).json({
      error: 'Hisobingiz bloklangan',
      ban_type: user.ban_type,
      ban_reason: user.ban_reason || 'Qoidalarni buzganlik uchun',
      ban_end_date: user.ban_end_date,
    });
  }

  req.user = user;
  next();
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const user = await authenticateToken(token);
    if (user && !user.is_banned) {
      req.user = user;
    }
  }
  next();
}

// ─── Mobil cheklov: boshqaruv panel so'rovlari smartfondan kelmasligi kerak ───
// Frontend mobil (<768px) rejimda panellarni umuman ko'rsatmaydi; bu — API to'siqi.
// User-agent UX-che'lovi (niyatli foydalanuvchini to'xtatadi), haqiqiy xavfsizlik
// chegarasi emas (asosiysi: role + step-up auth). Oddiy foydalanuvchi so'rovlari
// (report/appeal — faqat requireAuth) ta'sirlanmaydi.
export function isMobileUserAgent(req: Request): boolean {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  if (!ua) return false;
  if (/iphone|ipod|windows phone|blackberry/.test(ua)) return true;
  // Android: smartfonlar UA'da "Mobile" tokenini saqlaydi; planshetlarda yo'q.
  return ua.includes('android') && ua.includes('mobile');
}

function mobileBlocked(res: Response) {
  return res.status(403).json({
    error: 'mobile_blocked',
    message: 'Boshqaruv panellari mobil qurilmalarda ishlatilmaydi — kompyuter yoki planshetdan kiring',
  });
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    }

    if (!allowedRoles.includes(req.user.role as any)) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun sizda yetarli ruxsat yo‘q' });
    }

    // Staff amaliyoti — smartfon UA'da bloklanadi
    if (isMobileUserAgent(req)) return mobileBlocked(res);

    next();
  };
}

// ─── Faza 17: role hierarchy helpers ───────────────────────────────────
export const ROLE_LEVEL: Record<Role, number> = {
  USER: 0,
  INTERN_MOD: 1,
  MODERATOR: 2,
  LEAD_MOD: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5,
};

/** Any staff member (moderator tier or above). */
export function isStaffRole(role?: string | null): boolean {
  return !!role && role !== 'USER' && ROLE_LEVEL[role as Role] >= ROLE_LEVEL.INTERN_MOD;
}

export function hasMinLevel(role: string | null | undefined, min: Role): boolean {
  if (!role) return false;
  return (ROLE_LEVEL[role as Role] ?? -1) >= ROLE_LEVEL[min];
}

/** Middleware: require the authenticated user's role level >= min. */
export function requireMinLevel(min: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    }
    if (!hasMinLevel(req.user.role, min)) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun ruxsat darajangiz yetarli emas' });
    }
    // Staff amaliyoti — smartfon UA'da bloklanadi (moderator/admin/lead API'lari)
    if (isMobileUserAgent(req)) return mobileBlocked(res);
    next();
  };
}

/**
 * F-01: rate-limit bucket'lar uchun TASDIQLANGAN identity. Faqat JWT
 * signature'ini o'zi tekshiriladi (DB so'rovsiz, arzon); token yaroqsiz/soxta
 * bo'lsa `null` — chaqiruvchi IP'ga qaytadi. Shunda attacker soxta
 * `Authorization` qiymatlari bilan yangi bucket yarata olmaydi.
 */
export function verifiedUserIdFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as any;
    return typeof decoded?.id === 'string' && decoded.id ? decoded.id : null;
  } catch {
    return null;
  }
}

