import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateToken, requireAuth, verifyTelegramAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, runQuery, queryAll } from '../db/database.ts';
import { sendVerificationCodeEmail } from '../services/emailService.ts';
import { notifyWelcome } from '../services/notificationService.ts';

const router = Router();

// ─── Default cover gradients (same 10 presets as frontend COVER_GRADIENTS) ──
const COVER_GRADIENT_STYLES = [
  'linear-gradient(135deg, #a5b4fc 0%, #c084fc 35%, #f472b6 70%, #fed7aa 100%)',
  'linear-gradient(135deg, #1673E6 0%, #38BDF8 50%, #818CF8 100%)',
  'linear-gradient(135deg, #0EA5E9 0%, #06B6D4 50%, #3B82F6 100%)',
  'linear-gradient(135deg, #F97316 0%, #EC4899 50%, #8B5CF6 100%)',
  'linear-gradient(135deg, #059669 0%, #10B981 50%, #6EE7B7 100%)',
  'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)',
  'linear-gradient(135deg, #E0E7FF 0%, #DDD6FE 40%, #FCE7F3 100%)',
  'linear-gradient(135deg, #4C1D95 0%, #7C3AED 50%, #C084FC 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #F97316 60%, #EF4444 100%)',
  'linear-gradient(135deg, #334155 0%, #475569 50%, #64748B 100%)',
];

/** Returns a random cover gradient for new users */
function randomGradient(): string {
  return COVER_GRADIENT_STYLES[Math.floor(Math.random() * COVER_GRADIENT_STYLES.length)];
}

// ─── Auth helpers (email codes + profile state) ─────────────────────────
const EMAIL_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Generate a 6-digit code, persist it and email it to the address. */
async function issueEmailCode(email: string, type: string, subject: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeId = `otp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_CODE_TTL_MS).toISOString();

  await runQuery('DELETE FROM email_verification_codes WHERE email = ? AND type = ?', [email, type]);
  await runQuery(
    `INSERT INTO email_verification_codes (id, email, code, type, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [codeId, email, code, type, expiresAt, now.toISOString()]
  );

  const emailRes = await sendVerificationCodeEmail(email, code, subject);
  return { code, simulated: Boolean(emailRes.simulated) };
}

/** Validate a pending code (does not delete it). */
async function matchEmailCode(email: string, code: string, type: string) {
  return queryOne<any>(
    `SELECT * FROM email_verification_codes
     WHERE email = ? AND code = ? AND type = ? AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code.trim(), type]
  );
}

async function clearEmailCodes(email: string, type: string) {
  await runQuery('DELETE FROM email_verification_codes WHERE email = ? AND type = ?', [email, type]);
}

/** Mandatory profile = real name + phone + region + district (photo is optional). */
function computeProfileComplete(u: any): boolean {
  return Boolean(
    u &&
      u.name && u.name.trim().length >= 2 &&
      u.phone && u.phone.trim().length >= 6 &&
      u.region_id && u.district_id
  );
}

/** Strip secrets and attach computed auth/profile flags before sending to client. */
function serializeUser(u: any) {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return {
    ...rest,
    email_verified: Boolean(u.email) && Number(u.email_verified || 0) === 1,
    has_password: Boolean(u.password_hash),
    has_google: Boolean(u.telegram_id && String(u.telegram_id).startsWith('google:')),
    is_profile_complete: computeProfileComplete(u),
  };
}

// ─── Public Auth Config (Google Client ID, etc.) ────────────────────────
router.get('/config', (_req, res) => {
  res.json({
    googleClientId: process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
  });
});

// Checks if credentials match the .env Admin account, otherwise checks DB user account
async function loginHandler(req: any, res: any) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parol kiritilishi shart' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminHash = process.env.ADMIN_PASSWORD_HASH || '';

    // 1. Check if user is signing in with .env Admin credentials
    if (adminEmail && adminHash && cleanEmail === adminEmail) {
      const isMatch = await bcrypt.compare(password, adminHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
      }

      // Find or create admin user in DB
      let adminUser = await queryOne<any>('SELECT * FROM users WHERE role = ? LIMIT 1', ['ADMIN']);
      if (!adminUser) {
        const newId = 'usr_admin';
        const now = new Date().toISOString();
        await runQuery(
          `INSERT INTO users (id, email, name, cover_gradient, role, is_banned, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'ADMIN', 0, ?, ?)
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'ADMIN'`,
          [newId, cleanEmail, 'TopHand Admin', randomGradient(), now, now]
        );
        adminUser = await queryOne<any>('SELECT * FROM users WHERE id = ?', [newId]);
      }

      if (!adminUser) {
        return res.status(500).json({ error: 'Admin hisobi topilmadi' });
      }

      const token = generateToken(adminUser);
      return res.json({ token, user: serializeUser(adminUser), is_admin: true });
    }

    // 2. Regular User Login from DB
    const user = await queryOne<any>('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (!user) {
      return res.status(401).json({
        error: "Ushbu email bilan hisob topilmadi. Avval ro'yxatdan o'ting.",
        not_registered: true,
      });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        error: "Ushbu hisob Google orqali ochilgan. Iltimos, Google orqali kiring yoki parolni tiklang.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
    }

    if (user.is_banned) {
      // Auto-lift expired temporary bans
      if (user.ban_type === 'TEMPORARY' && user.ban_end_date && new Date(user.ban_end_date) <= new Date()) {
        await runQuery(
          `UPDATE users SET is_banned = 0, ban_type = 'NONE', ban_reason = NULL, ban_end_date = NULL, updated_at = ? WHERE id = ?`,
          [new Date().toISOString(), user.id]
        );
        // Continue login — ban has expired
      } else {
        return res.status(403).json({
          error: 'Hisobingiz bloklangan',
          ban_type: user.ban_type,
          ban_reason: user.ban_reason,
          ban_end_date: user.ban_end_date,
        });
      }
    }

    const token = generateToken(user);
    res.json({ token, user: serializeUser(user), is_admin: user.role === 'ADMIN' });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Tizimga kirishda xatolik yuz berdi' });
  }
}

router.post('/login', loginHandler);
router.post('/admin-login', loginHandler);

// ─── Step 1: Start email registration → send verification code ──────────
router.post('/register/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return res.status(400).json({ error: "To'g'ri email manzil kiriting" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (cleanEmail === adminEmail) {
      return res.status(400).json({ error: "Ushbu email tizim ma'muri uchun band qilingan" });
    }

    const existing = await queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'Ushbu email bilan hisob allaqachon mavjud. Tizimga kiring.' });
    }

    const { code, simulated } = await issueEmailCode(
      cleanEmail,
      'EMAIL_VERIFICATION',
      "TopHand - Ro'yxatdan o'tish tasdiqlash kodi"
    );

    res.json({
      success: true,
      message: 'Tasdiqlash kodi emailingizga yuborildi',
      simulated,
      demo_code: simulated ? code : undefined,
    });
  } catch (err: any) {
    console.error('Register send-code error:', err);
    res.status(500).json({ error: err.message || 'Kodni yuborishda xatolik yuz berdi' });
  }
});

// ─── Step 2: Confirm code + set password → create account ───────────────
router.post('/register', async (req, res) => {
  try {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ error: "Email, tasdiqlash kodi va parol kiritilishi shart" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'Ushbu email bilan hisob allaqachon mavjud' });
    }

    const codeRecord = await matchEmailCode(cleanEmail, code, 'EMAIL_VERIFICATION');
    if (!codeRecord) {
      return res.status(400).json({ error: "Tasdiqlash kodi noto'g'ri yoki uning muddati o'tgan" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();
    // name is a placeholder; the mandatory profile step collects the real name.
    const placeholderName = cleanEmail.split('@')[0];

    await runQuery(
      `INSERT INTO users (id, email, password_hash, name, cover_gradient, role, email_verified, is_banned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'USER', 1, 0, ?, ?)`,
      [userId, cleanEmail, passwordHash, placeholderName, randomGradient(), now, now]
    );

    await clearEmailCodes(cleanEmail, 'EMAIL_VERIFICATION');

    const newUser = await queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    const token = generateToken(newUser);

    // Welcome notification for the new account (signed by the TopHand team).
    notifyWelcome(userId).catch(() => {});

    res.status(201).json({ token, user: serializeUser(newUser), is_new: true });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || "Ro'yxatdan o'tishda xatolik yuz berdi" });
  }
});

// ─── Forgot Password (Send 6-digit confirmation code) ───────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email manzilini kiriting' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    if (cleanEmail === adminEmail) {
      return res.status(400).json({
        error: "Bosh administrator paroli serverning xavfsiz .env konfiguratsiyasida saqlanadi va u orqali boshqariladi.",
      });
    }

    const user = await queryOne<any>('SELECT id, name FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (!user) {
      return res.status(404).json({ error: "Ushbu email bilan hisob topilmadi" });
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeId = `otp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Delete any old pending codes for this email
    await runQuery('DELETE FROM email_verification_codes WHERE email = ?', [cleanEmail]);

    // Save new code
    await runQuery(
      `INSERT INTO email_verification_codes (id, email, code, type, expires_at, created_at)
       VALUES (?, ?, ?, 'PASSWORD_RESET', ?, ?)`,
      [codeId, cleanEmail, code, expiresAt, now.toISOString()]
    );

    // Send code to email
    const emailRes = await sendVerificationCodeEmail(cleanEmail, code, 'TopHand - Parolni tiklash kodi');

    res.json({
      success: true,
      message: 'Tasdiqlash kodi emailingizga yuborildi',
      simulated: emailRes.simulated,
      // For easy demo/development testing if SMTP credentials aren't set
      demo_code: emailRes.simulated ? code : undefined,
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: err.message || 'Kodni yuborishda xatolik yuz berdi' });
  }
});

// ─── Reset Password with Confirmation Code ──────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, new_password } = req.body;

    if (!email || !code || !new_password) {
      return res.status(400).json({ error: "Email, tasdiqlash kodi va yangi parol kiritilishi shart" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Verify code
    const codeRecord = await queryOne<any>(
      `SELECT * FROM email_verification_codes 
       WHERE email = ? AND code = ? AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode]
    );

    if (!codeRecord) {
      return res.status(400).json({ error: "Tasdiqlash kodi noto'g'ri yoki uning muddati o'tgan" });
    }

    // Hash new password and update user
    const newHash = await bcrypt.hash(new_password, 10);
    const now = new Date().toISOString();

    await runQuery(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE LOWER(email) = ?`,
      [newHash, now, cleanEmail]
    );

    // Delete used verification code
    await runQuery('DELETE FROM email_verification_codes WHERE email = ?', [cleanEmail]);

    res.json({ success: true, message: "Parol muvaffaqiyatli yangilandi! Yangi parol bilan kiring." });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message || 'Parolni yangilashda xatolik yuz berdi' });
  }
});

// ─── Google OAuth Login ─────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential, name, email, picture, googleId } = req.body;

    if (!googleId && !email) {
      return res.status(400).json({ error: "Google ma'lumotlari noto'g'ri" });
    }

    const googleUserId = googleId || `google_${crypto.createHash('md5').update(email).digest('hex').slice(0, 16)}`;
    const displayName = name || email?.split('@')[0] || 'Foydalanuvchi';
    const photoUrl = picture || null;
    const cleanEmail = email ? email.trim().toLowerCase() : null;

    // Find or create user by Google ID or Email
    const lookupId = `google:${googleUserId}`;
    let user = await queryOne<any>(
      'SELECT * FROM users WHERE telegram_id = ? OR (email IS NOT NULL AND email = ?)',
      [lookupId, cleanEmail]
    );
    const now = new Date().toISOString();
    let created = false;

    if (!user) {
      created = true;
      const newId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await runQuery(
        `INSERT INTO users (id, telegram_id, email, name, profile_photo_url, cover_gradient, role, email_verified, is_banned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'USER', 1, 0, ?, ?)`,
        [newId, lookupId, cleanEmail, displayName, photoUrl, randomGradient(), now, now]
      );
      user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [newId]);
      // Welcome notification for accounts created via Google.
      notifyWelcome(newId, displayName).catch(() => {});
    } else {
      // Google-verified email → mark verified when we attach/refresh it here.
      // IMPORTANT: never overwrite a photo the user already uploaded with Google's.
      // COALESCE(profile_photo_url, ?) keeps the existing value and only fills from
      // Google when the user has no photo yet.
      await runQuery(
        `UPDATE users 
         SET profile_photo_url = COALESCE(profile_photo_url, ?),
             email = COALESCE(?, email),
             email_verified = CASE WHEN email IS NOT NULL THEN 1 ELSE email_verified END,
             updated_at = ? 
         WHERE id = ?`,
        [photoUrl, cleanEmail, now, user.id]
      );
      user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [user.id]);
    }

    if (user.is_banned) {
      // Auto-lift expired temporary bans
      if (user.ban_type === 'TEMPORARY' && user.ban_end_date && new Date(user.ban_end_date) <= new Date()) {
        await runQuery(
          `UPDATE users SET is_banned = 0, ban_type = 'NONE', ban_reason = NULL, ban_end_date = NULL, updated_at = ? WHERE id = ?`,
          [new Date().toISOString(), user.id]
        );
        user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [user.id]);
      } else {
        return res.status(403).json({
          error: 'Hisobingiz bloklangan',
          ban_type: user.ban_type,
          ban_reason: user.ban_reason,
          ban_end_date: user.ban_end_date,
        });
      }
    }

    const token = generateToken(user);
    const safe = serializeUser(user);
    res.json({ token, user: safe, is_new: created, needs_profile: !safe.is_profile_complete, is_admin: user.role === 'ADMIN' });
  } catch (err: any) {
    console.error('Google login error:', err);
    res.status(500).json({ error: err.message || 'Google orqali kirishda xatolik' });
  }
});

// ─── Current Authenticated User (GET /api/auth/me) ──────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const activeListingsRes = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM listings WHERE owner_user_id = ? AND status = 'ACTIVE'`,
      [user.id]
    );
    const archivedListingsRes = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM listings WHERE owner_user_id = ? AND status IN ('ARCHIVED', 'COMPLETED')`,
      [user.id]
    );

    user.active_listing_count = activeListingsRes?.count || 0;
    user.archived_listing_count = archivedListingsRes?.count || 0;

    res.json(serializeUser(user));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Onboarding endpoint ────────────────────────────────────────────────
router.post('/onboarding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { region_id, district_id, phone, bio, latitude, longitude } = req.body;

    if (!region_id || !district_id) {
      return res.status(400).json({ error: 'Viloyat va tuman kiritilishi shart' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE users 
       SET region_id = ?, district_id = ?, phone = COALESCE(?, phone), bio = COALESCE(?, bio),
           latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), updated_at = ?
       WHERE id = ?`,
      [region_id, district_id, phone || null, bio || null, latitude || null, longitude || null, now, req.user!.id]
    );

    const updatedUser = await queryOne('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: serializeUser(updatedUser) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mandatory profile completion (name + phone + photo + location) ─────
router.post('/profile/complete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      first_name,
      last_name,
      name,
      phone,
      profile_photo_url,
      region_id,
      district_id,
      bio,
      latitude,
      longitude,
    } = req.body || {};

    const fullName =
      (name && name.trim()) ||
      [first_name, last_name].filter(Boolean).map((s) => String(s).trim()).join(' ').trim();
    const cleanPhone = (phone || '').trim();

    if (fullName.split(/\s+/).length < 2) {
      return res.status(400).json({ error: 'Ism va familiyangizni to‘liq kiriting' });
    }
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 9) {
      return res.status(400).json({ error: 'Telefon raqami majburiy va to‘liq bo‘lishi kerak' });
    }
    if (!region_id || !district_id) {
      return res.status(400).json({ error: 'Viloyat va tumanni tanlang' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE users
       SET name = ?, phone = ?, profile_photo_url = COALESCE(?, profile_photo_url), region_id = ?, district_id = ?,
           bio = COALESCE(?, bio), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
           updated_at = ?
       WHERE id = ?`,
      [fullName, cleanPhone, profile_photo_url || null, region_id, district_id, (bio || '').trim() || null,
        latitude || null, longitude || null, now, req.user!.id]
    );

    const updated = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: serializeUser(updated) });
  } catch (err: any) {
    console.error('Profile complete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Link an email to the current (e.g. Google) account: send code ──────
router.post('/email/send-code', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return res.status(400).json({ error: "To'g'ri email manzil kiriting" });
    }
    const cleanEmail = email.trim().toLowerCase();

    const clash = await queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?', [cleanEmail, req.user!.id]);
    if (clash) {
      return res.status(400).json({ error: 'Ushbu email boshqa hisobga biriktirilgan' });
    }

    const { code, simulated } = await issueEmailCode(cleanEmail, 'EMAIL_VERIFICATION', 'TopHand - Email tasdiqlash kodi');
    res.json({ success: true, message: 'Tasdiqlash kodi emailingizga yuborildi', simulated, demo_code: simulated ? code : undefined });
  } catch (err: any) {
    console.error('Link email send-code error:', err);
    res.status(500).json({ error: err.message || 'Kodni yuborishda xatolik yuz berdi' });
  }
});

// ─── Confirm the code and attach the (verified) email to current account ─
router.post('/email/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email va kod kiritilishi shart' });
    }
    const cleanEmail = email.trim().toLowerCase();

    const codeRecord = await matchEmailCode(cleanEmail, code, 'EMAIL_VERIFICATION');
    if (!codeRecord) {
      return res.status(400).json({ error: "Tasdiqlash kodi noto'g'ri yoki uning muddati o'tgan" });
    }

    const now = new Date().toISOString();
    await runQuery('UPDATE users SET email = ?, email_verified = 1, updated_at = ? WHERE id = ?', [
      cleanEmail, now, req.user!.id,
    ]);
    await clearEmailCodes(cleanEmail, 'EMAIL_VERIFICATION');

    const updated = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: serializeUser(updated) });
  } catch (err: any) {
    console.error('Link email verify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Link a Google account to the current (e.g. email) account ──────────
router.post('/google/link', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { googleId, email, picture } = req.body;
    if (!googleId && !email) {
      return res.status(400).json({ error: "Google ma'lumotlari noto'g'ri" });
    }
    const googleUserId = googleId || `google_${crypto.createHash('md5').update(email).digest('hex').slice(0, 16)}`;
    const lookupId = `google:${googleUserId}`;

    const already = await queryOne<any>('SELECT id FROM users WHERE telegram_id = ? AND id <> ?', [lookupId, req.user!.id]);
    if (already) {
      return res.status(400).json({ error: 'Ushbu Google hisob allaqachon boshqa akkauntga ulangan' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE users SET telegram_id = ?, profile_photo_url = COALESCE(profile_photo_url, ?), updated_at = ? WHERE id = ?`,
      [lookupId, picture || null, now, req.user!.id]
    );

    const updated = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: serializeUser(updated) });
  } catch (err: any) {
    console.error('Link google error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Personas endpoint returns empty array (test accounts removed)
router.get('/personas', async (_req, res) => {
  res.json([]);
});

export default router;
