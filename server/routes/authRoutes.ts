import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateToken, requireAuth, verifyTelegramAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, runQuery, queryAll, runTransaction } from '../db/database.ts';
import { sendVerificationCodeEmail } from '../services/emailService.ts';
import { reqLang, type MsgLocale } from '../i18n/messages.ts';
import { notifyWelcome } from '../services/notificationService.ts';
import { sanitizeUserUrl } from '../lib/urlSecurity.ts';

const router = Router();

// ─── SECURITY (C-01): server-side Google ID-token verification ───────────
// The client (Google Identity Services) hands us an ID token (`credential`).
// We MUST verify it against Google before trusting any identity claim. Never
// take googleId/email/name/picture from the request body as authoritative —
// an attacker could forge them to take over any account. Here we validate the
// token via Google's tokeninfo endpoint (signature/iss/exp checked by Google)
// and pin `aud` to our own OAuth client id. For very high login volume,
// switch to local JWKS verification (google-auth-library) to avoid the extra
// network call, but the trust model stays identical: identity comes ONLY from
// the verified token payload.
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();

interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

async function verifyGoogleIdToken(credential: unknown): Promise<VerifiedGoogleIdentity> {
  if (!credential || typeof credential !== 'string') {
    throw Object.assign(new Error('Google credential topilmadi'), { status: 400 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let payload: any;
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { signal: controller.signal }
    );
    if (!r.ok) {
      throw Object.assign(new Error('Google token yaroqsiz yoki muddati o\'tgan'), { status: 401 });
    }
    payload = await r.json();
  } finally {
    clearTimeout(timer);
  }

  const iss = payload?.iss;
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw Object.assign(new Error('Google token iss noto\'g\'ri'), { status: 401 });
  }
  if (!payload?.exp || Number(payload.exp) * 1000 < Date.now()) {
    throw Object.assign(new Error('Google token muddati o\'tgan'), { status: 401 });
  }
  if (GOOGLE_CLIENT_ID) {
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      throw Object.assign(new Error('Google token aud mos emas'), { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Fail closed: without a pinned client id we cannot bind the audience.
    throw Object.assign(new Error('GOOGLE_CLIENT_ID sozlanmagan — production\'da Google login o\'chirilgan'), { status: 500 });
  }
  if (!payload?.sub) {
    throw Object.assign(new Error('Google token sub yo\'q'), { status: 401 });
  }

  const emailVerified = payload.email_verified === true || String(payload.email_verified) === 'true';
  if (process.env.NODE_ENV === 'production' && !emailVerified) {
    throw Object.assign(new Error('Google email tasdiqlanmagan'), { status: 401 });
  }

  return {
    sub: String(payload.sub),
    email: (payload.email || '').trim().toLowerCase(),
    emailVerified,
    name: payload.name || (payload.email ? String(payload.email).split('@')[0] : 'Foydalanuvchi'),
    picture: payload.picture || null,
  };
}

// ─── Default cover gradients (same 10 pastel presets as frontend COVER_GRADIENTS) ──
const COVER_GRADIENT_STYLES = [
  'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 40%, #C7D2FE 100%)',   // Sky Bliss
  'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 40%, #FED7AA 100%)',   // Peach Glow
  'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 40%, #FDE8D8 100%)',   // Rose Blush
  'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 40%, #CFFAFE 100%)',   // Mint Fresh
  'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 45%, #E0E7FF 100%)',   // Lavender Soft
  'linear-gradient(135deg, #DBEAFE 0%, #E0F2FE 50%, #F0F9FF 100%)',   // TopHand Light
  'linear-gradient(135deg, #FEF9C3 0%, #FED7AA 50%, #FECACA 100%)',   // Sunrise Peach
  'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 45%, #FCE7F3 100%)',   // Soft Lilac
  'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 45%, #CFFAFE 100%)',   // Cool Mist
  'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 45%, #E2E8F0 100%)',   // Cream Cloud
];

/** Returns a random cover gradient for new users */
function randomGradient(): string {
  return COVER_GRADIENT_STYLES[Math.floor(Math.random() * COVER_GRADIENT_STYLES.length)];
}

// ─── Auth helpers (email codes + profile state) ─────────────────────────
const EMAIL_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// H-01: never expose a verification/reset code in the API response in
// production, even if the email layer somehow reports `simulated`.
function demoCode(simulated: boolean | undefined, code: string): string | undefined {
  return simulated && process.env.NODE_ENV !== 'production' ? code : undefined;
}

// SECURITY (M-01/L-02): OTP is generated with a CSPRNG, stored ONLY as a
// SHA-256 hash (never plaintext), bound to a purpose `type`, guarded by a
// per-code failed-attempt counter + temporary lockout, and atomically consumed
// on success so a code can never be replayed.
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000; // lock 15 minutes after too many failures

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Generate a 6-digit code, persist its hash and email the plaintext. */
async function issueEmailCode(email: string, type: string, subject: string, lang: MsgLocale = 'uz') {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeId = `otp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_CODE_TTL_MS).toISOString();

  await runQuery('DELETE FROM email_verification_codes WHERE email = ? AND type = ?', [email, type]);
  await runQuery(
    `INSERT INTO email_verification_codes (id, email, code, type, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [codeId, email, hashOtp(code), type, expiresAt, now.toISOString()]
  );

  const emailRes = await sendVerificationCodeEmail(email, code, subject, lang);
  return { code, simulated: Boolean(emailRes.simulated) };
}

export interface OtpVerifyResult {
  ok: boolean;
  reason?: 'invalid' | 'locked';
  retry_after_ms?: number;
}

// Verify + atomically consume a code for (email, type). L-02: strictly bound to
// `type` so a code issued for one flow can never satisfy another. M-01: counts
// failed attempts within a row lock and temporarily locks after the limit.
async function consumeEmailCode(email: string, plainCode: string, type: string): Promise<OtpVerifyResult> {
  const code = (plainCode || '').trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid' };
  const codeHash = hashOtp(code);

  let result: OtpVerifyResult = { ok: false, reason: 'invalid' };
  await runTransaction(async (client) => {
    const sel = await client.query(
      `SELECT id, code, attempt_count,
              (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked,
              GREATEST(0, EXTRACT(EPOCH FROM (locked_until - NOW())))::bigint AS lock_remaining_s
       FROM email_verification_codes
       WHERE email = $1 AND type = $2 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [email, type]
    );
    const row = sel.rows[0];
    if (!row) { result = { ok: false, reason: 'invalid' }; return; }

    if (row.is_locked) {
      result = { ok: false, reason: 'locked', retry_after_ms: Number(row.lock_remaining_s || 0) * 1000 };
      return;
    }

    if (row.code === codeHash) {
      // Success → consume all codes for this email+type (one-time use).
      await client.query('DELETE FROM email_verification_codes WHERE email = $1 AND type = $2', [email, type]);
      result = { ok: true };
      return;
    }

    const attempts = Number(row.attempt_count || 0) + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await client.query(
        'UPDATE email_verification_codes SET attempt_count = $1, locked_until = NOW() + make_interval(secs => $2::int) WHERE id = $3',
        [attempts, Math.floor(OTP_LOCK_MS / 1000), row.id]
      );
      result = { ok: false, reason: 'locked', retry_after_ms: OTP_LOCK_MS };
    } else {
      await client.query('UPDATE email_verification_codes SET attempt_count = $1 WHERE id = $2', [attempts, row.id]);
      result = { ok: false, reason: 'invalid' };
    }
  });
  return result;
}

async function clearEmailCodes(email: string, type: string) {
  await runQuery('DELETE FROM email_verification_codes WHERE email = ? AND type = ?', [email, type]);
}

// User-facing message for a failed OTP verify (distinguishes temporary lockout).
function otpMessage(r: OtpVerifyResult): string {
  if (r.reason === 'locked') {
    const mins = Math.max(1, Math.ceil((r.retry_after_ms || OTP_LOCK_MS) / 60000));
    return `Juda ko'p noto'g'ri urinish. Qayta urinish uchun ${mins} daqiqa kuting.`;
  }
  return "Tasdiqlash kodi noto'g'ri yoki uning muddati o'tgan";
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
// M-02: a fixed dummy hash so we always run exactly one bcrypt.compare, keeping
// response timing constant whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

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
    // M-02: identical status/body whether the email is unknown, is a Google-only
    // account (no password) or the password is wrong — blocks enumeration.
    const user = await queryOne<any>('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    const storedHash = user && user.password_hash ? user.password_hash : DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!user || !user.password_hash || !isMatch) {
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

    // M-02: do NOT reveal whether this email is already registered (or reserved
    // for the admin). Always respond with the SAME generic success; a code is only
    // actually issued/sent when no account exists yet. The real "already exists"
    // check happens at /register (after email possession is proven by the code).
    const existing = await queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);

    let regCode: string | undefined;
    let simulated = false;
    if (!existing && cleanEmail !== adminEmail) {
      const issued = await issueEmailCode(
        cleanEmail,
        'EMAIL_VERIFICATION',
        "TopHand - Ro'yxatdan o'tish tasdiqlash kodi",
        reqLang(req)
      );
      regCode = issued.code;
      simulated = issued.simulated;
    }

    res.json({
      success: true,
      message: "Agar ushbu email ro'yxatdan o'tmagan bo'lsa, tasdiqlash kodi yuborildi.",
      demo_code: demoCode(simulated, regCode || ''),
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

    // Reserved admin email is managed via .env, never via self-registration.
    if (cleanEmail === (process.env.ADMIN_EMAIL || '').trim().toLowerCase()) {
      return res.status(400).json({ error: "Ushbu email bilan hisob yaratib bo'lmaydi" });
    }

    const otp = await consumeEmailCode(cleanEmail, code, 'EMAIL_VERIFICATION');
    if (!otp.ok) {
      return res.status(otp.reason === 'locked' ? 429 : 400).json({ error: otpMessage(otp) });
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

    // M-02: never reveal whether an email is registered (or the reserved admin).
    // Always return the SAME generic success; a code is only actually sent when a
    // matching, non-admin account exists. L-02: code is bound to PASSWORD_RESET.
    const user = adminEmail && cleanEmail === adminEmail
      ? null
      : await queryOne<any>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);

    let issuedCode: string | undefined;
    let simulated = false;
    if (user) {
      const issued = await issueEmailCode(cleanEmail, 'PASSWORD_RESET', 'TopHand - Parolni tiklash kodi', reqLang(req));
      issuedCode = issued.code;
      simulated = issued.simulated;
    }

    res.json({
      success: true,
      message: "Agar ushbu email bilan hisob mavjud bo'lsa, parolni tiklash kodi yuborildi.",
      demo_code: demoCode(simulated, issuedCode || ''),
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

    // Verify + atomically consume a PASSWORD_RESET code (L-02 purpose binding,
    // M-01 attempt limit + one-time use).
    const otp = await consumeEmailCode(cleanEmail, cleanCode, 'PASSWORD_RESET');
    if (!otp.ok) {
      return res.status(otp.reason === 'locked' ? 429 : 400).json({ error: otpMessage(otp) });
    }

    // Hash new password and update user
    const newHash = await bcrypt.hash(new_password, 10);
    const now = new Date().toISOString();

    await runQuery(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE LOWER(email) = ?`,
      [newHash, now, cleanEmail]
    );

    // Reset codes were consumed atomically above (consumeEmailCode deletes them).

    res.json({ success: true, message: "Parol muvaffaqiyatli yangilandi! Yangi parol bilan kiring." });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message || 'Parolni yangilashda xatolik yuz berdi' });
  }
});

// ─── Google OAuth Login ─────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    // C-01: verify the Google ID token server-side and derive identity ONLY
    // from the verified payload. Client-supplied googleId/email/name/picture
    // are ignored as an identity source.
    let guser: VerifiedGoogleIdentity;
    try {
      guser = await verifyGoogleIdToken(credential);
    } catch (e: any) {
      return res.status(e?.status || 401).json({ error: e?.message || 'Google tokenini tasdiqlab bo\'lmadi' });
    }

    const googleUserId = guser.sub;
    const displayName = guser.name;
    const photoUrl = guser.picture;
    // Only trust an email when Google reports it as verified.
    const cleanEmail = guser.emailVerified && guser.email ? guser.email : null;

    // Find or create user by Google ID or (verified) Email
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
      [fullName, cleanPhone, sanitizeUserUrl(profile_photo_url) || null, region_id, district_id, (bio || '').trim() || null,
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

    const { code, simulated } = await issueEmailCode(cleanEmail, 'EMAIL_VERIFICATION', 'TopHand - Email tasdiqlash kodi', reqLang(req));
    res.json({ success: true, message: 'Tasdiqlash kodi emailingizga yuborildi', simulated, demo_code: demoCode(simulated, code) });
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

    const otp = await consumeEmailCode(cleanEmail, code, 'EMAIL_VERIFICATION');
    if (!otp.ok) {
      return res.status(otp.reason === 'locked' ? 429 : 400).json({ error: otpMessage(otp) });
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
    const { credential, picture } = req.body;
    // C-01: verify the token; identity comes from the verified sub, never the body.
    let guser: VerifiedGoogleIdentity;
    try {
      guser = await verifyGoogleIdToken(credential);
    } catch (e: any) {
      return res.status(e?.status || 401).json({ error: e?.message || 'Google tokenini tasdiqlab bo\'lmadi' });
    }
    const googleUserId = guser.sub;
    const lookupId = `google:${googleUserId}`;

    const already = await queryOne<any>('SELECT id FROM users WHERE telegram_id = ? AND id <> ?', [lookupId, req.user!.id]);
    if (already) {
      return res.status(400).json({ error: 'Ushbu Google hisob allaqachon boshqa akkauntga ulangan' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE users SET telegram_id = ?, profile_photo_url = COALESCE(profile_photo_url, ?), updated_at = ? WHERE id = ?`,
      [lookupId, guser.picture || picture || null, now, req.user!.id]
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
