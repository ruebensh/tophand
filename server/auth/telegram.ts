import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'tophand-jwt-secret-uzbekistan-2026';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export interface AuthUser {
  id: string;
  telegram_id: string;
  telegram_username?: string;
  name: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
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

export function generateToken(user: { id: string; telegram_id: string; role: string }): string {
  return jwt.sign(
    {
      id: user.id,
      telegram_id: user.telegram_id,
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

export function requireRole(allowedRoles: ('MODERATOR' | 'ADMIN')[]) {
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
