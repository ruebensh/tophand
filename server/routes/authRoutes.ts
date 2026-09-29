import { Router } from 'express';
import crypto from 'crypto';
import { generateToken, requireAuth, verifyTelegramAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, runQuery, queryAll } from '../db/database.ts';

const router = Router();

// Telegram Login Widget endpoint
router.post('/telegram', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.id) {
      return res.status(400).json({ error: "Telegram ma'lumotlari kiritilmadi" });
    }

    const isValid = verifyTelegramAuth(data);
    if (!isValid) {
      return res.status(401).json({ error: "Telegram autentifikatsiyasi tasdiqlanmadi (yaroqsiz hash)" });
    }

    const telegramId = String(data.id);
    const telegramUsername = data.username || null;
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || telegramUsername || `Foydalanuvchi #${telegramId}`;
    const photoUrl = data.photo_url || null;

    let user = await queryOne<any>('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
    const now = new Date().toISOString();

    if (!user) {
      const newId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await runQuery(
        `INSERT INTO users (id, telegram_id, telegram_username, name, profile_photo_url, role, is_banned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'USER', 0, ?, ?)`,
        [newId, telegramId, telegramUsername, name, photoUrl, now, now]
      );
      user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [newId]);
    } else {
      // Update username or photo if changed
      await runQuery(
        `UPDATE users SET telegram_username = ?, profile_photo_url = COALESCE(?, profile_photo_url), updated_at = ? WHERE id = ?`,
        [telegramUsername, photoUrl, now, user.id]
      );
      user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [user.id]);
    }

    if (user.is_banned) {
      return res.status(403).json({
        error: 'Hisobingiz bloklangan',
        ban_type: user.ban_type,
        ban_reason: user.ban_reason,
        ban_end_date: user.ban_end_date,
      });
    }

    const token = generateToken(user);
    res.json({ token, user, is_new: !user.region_id });
  } catch (err: any) {
    console.error('Telegram login error:', err);
    res.status(500).json({ error: err.message || 'Tizimga kirishda xatolik yuz berdi' });
  }
});

// Quick persona switcher for development / demo evaluation
router.post('/dev-login', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Foydalanuvchi tanlanmadi' });
    }

    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const token = generateToken(user);
    res.json({ token, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get current authenticated user
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await queryOne<any>(
      `SELECT u.*, r.name_uz as region_name, d.name_uz as district_name 
       FROM users u
       LEFT JOIN regions r ON u.region_id = r.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE u.id = ?`,
      [req.user!.id]
    );

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
    const followersRes = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM follows WHERE followed_user_id = ?`,
      [user.id]
    );
    const followingRes = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM follows WHERE follower_user_id = ?`,
      [user.id]
    );

    user.active_listing_count = activeListingsRes?.count || 0;
    user.archived_listing_count = archivedListingsRes?.count || 0;
    user.follower_count = followersRes?.count || 0;
    user.following_count = followingRes?.count || 0;
    user.is_profile_complete = Boolean(user.profile_photo_url && user.bio && user.bio.trim().length >= 15);

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Onboarding endpoint
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

// Get test personas for demonstration
router.get('/personas', async (_req, res) => {
  try {
    const personas = await queryAll<any>(
      `SELECT id, name, role, telegram_username, profile_photo_url, bio, is_banned 
       FROM users 
       ORDER BY CASE role WHEN 'ADMIN' THEN 1 WHEN 'MODERATOR' THEN 2 ELSE 3 END, id ASC`
    );
    res.json(personas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
