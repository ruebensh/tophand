import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateToken, requireAuth, verifyTelegramAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, runQuery, queryAll } from '../db/database.ts';
import { sendVerificationCodeEmail } from '../services/emailService.ts';

const router = Router();

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
          `INSERT INTO users (id, email, name, role, is_banned, created_at, updated_at)
           VALUES (?, ?, ?, 'ADMIN', 0, ?, ?)
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'ADMIN'`,
          [newId, cleanEmail, 'TopHand Admin', now, now]
        );
        adminUser = await queryOne<any>('SELECT * FROM users WHERE id = ?', [newId]);
      }

      if (!adminUser) {
        return res.status(500).json({ error: 'Admin hisobi topilmadi' });
      }

      const token = generateToken(adminUser);
      return res.json({ token, user: adminUser, is_admin: true });
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
      return res.status(403).json({
        error: 'Hisobingiz bloklangan',
        ban_type: user.ban_type,
        ban_reason: user.ban_reason,
      });
    }

    const token = generateToken(user);
    res.json({ token, user, is_admin: user.role === 'ADMIN' });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Tizimga kirishda xatolik yuz berdi' });
  }
}

router.post('/login', loginHandler);
router.post('/admin-login', loginHandler);

// ─── User Registration via Email + Password ─────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldirish shart" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    if (cleanEmail === adminEmail) {
      return res.status(400).json({ error: "Ushbu email tizim ma'muri uchun band qilingan" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" });
    }

    // Check if user already exists
    const existing = await queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: "Ushbu email bilan hisob allaqachon mavjud" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO users (id, email, password_hash, name, role, is_banned, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'USER', 0, ?, ?)`,
      [userId, cleanEmail, passwordHash, name.trim(), now, now]
    );

    const newUser = await queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    const token = generateToken(newUser);

    res.status(201).json({ token, user: newUser, is_new: true });
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

    if (!user) {
      const newId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await runQuery(
        `INSERT INTO users (id, telegram_id, email, name, profile_photo_url, role, is_banned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'USER', 0, ?, ?)`,
        [newId, lookupId, cleanEmail, displayName, photoUrl, now, now]
      );
      user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [newId]);
    } else {
      await runQuery(
        `UPDATE users 
         SET profile_photo_url = COALESCE(?, profile_photo_url),
             email = COALESCE(?, email),
             updated_at = ? 
         WHERE id = ?`,
        [photoUrl, cleanEmail, now, user.id]
      );
      user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [user.id]);
    }

    if (user.is_banned) {
      return res.status(403).json({
        error: 'Hisobingiz bloklangan',
        ban_type: user.ban_type,
        ban_reason: user.ban_reason,
      });
    }

    const token = generateToken(user);
    res.json({ token, user, is_new: !user.region_id, is_admin: user.role === 'ADMIN' });
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
      `SELECT COUNT(*) as count FROM listings WHERE owner_user_id = ? AND status = 'ARCHIVED'`,
      [user.id]
    );

    user.active_listing_count = activeListingsRes?.count || 0;
    user.archived_listing_count = archivedListingsRes?.count || 0;
    user.is_profile_complete = Boolean(user.profile_photo_url && user.bio && user.bio.trim().length >= 15);

    res.json(user);
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
    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Personas endpoint returns empty array (test accounts removed)
router.get('/personas', async (_req, res) => {
  res.json([]);
});

export default router;
