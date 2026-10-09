import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/database.ts';

// SECURITY (H-02): never fall back to a known secret in a real deployment.
// Previously only NODE_ENV==='production' was rejected, so staging / preview /
// a mislabelled production silently used the hardcoded fallback below — letting
// anyone who reads the repo forge tokens for arbitrary user IDs and roles.
// We now fail closed for ANY environment except an explicit local dev/test.
// Bare `tsx watch` (NODE_ENV unset) is treated as local dev but warns loudly.
const nodeEnv = process.env.NODE_ENV;
const ALLOW_INSECURE_DEV = nodeEnv === undefined || nodeEnv === 'development' || nodeEnv === 'test';
if (!process.env.JWT_SECRET) {
  if (!ALLOW_INSECURE_DEV) {
    throw new Error(
      `FATAL: JWT_SECRET muhit o'zgaruvchisi qo'yilmagan — bu muhitda (${nodeEnv}) ishga tushirish taqiqlanadi (fail-closed).`
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
    // If bot token is not configured in local environment, allow verified simulation in dev
    return process.env.NODE_ENV !== 'production';
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
  return jwt.sign(
    {
      id: user.id,
      telegram_id: user.telegram_id || null,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
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

    // Check temporary ban expiration
    if (user.is_banned && user.ban_type === 'TEMPORARY' && user.ban_end_date) {
      if (new Date(user.ban_end_date).getTime() < Date.now()) {
        // Ban expired, unban automatically
        await queryOne(
          "UPDATE users SET is_banned = 0, ban_type = 'NONE', ban_reason = NULL, ban_end_date = NULL WHERE id = ?",
          [user.id]
        );
        user.is_banned = 0;
        user.ban_type = 'NONE';
      }
    }

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

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    }

    if (!allowedRoles.includes(req.user.role as any)) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun sizda yetarli ruxsat yo‘q' });
    }

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
    next();
  };
}
