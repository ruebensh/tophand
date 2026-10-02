import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, optionalAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, queryAll, runQuery } from '../db/database.ts';

const router = Router();

// Public user profile (Section 8: Phone number must NOT be publicly displayed on profile)
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const user = await queryOne<any>(
      `SELECT 
        u.id, u.telegram_username, u.name, u.profile_photo_url, u.bio, u.phone,
        u.region_id, u.district_id,
        u.created_at, u.role, u.is_banned, u.verification_status,
        r.name_uz as region_name, d.name_uz as district_name
       FROM users u
       LEFT JOIN regions r ON u.region_id = r.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    // Counts
    const activeListingsRes = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM listings WHERE owner_user_id = ? AND status = 'ACTIVE'`,
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
    user.follower_count = followersRes?.count || 0;
    user.following_count = followingRes?.count || 0;
    user.is_profile_complete = Boolean(
      user.name && user.name.trim().length >= 2 &&
      user.phone && user.phone.trim().length >= 6 &&
      user.region_id && user.district_id
    );

    // Follow status for viewer
    user.is_followed = false;
    if (req.user) {
      const follow = await queryOne(
        'SELECT id FROM follows WHERE follower_user_id = ? AND followed_user_id = ?',
        [req.user.id, user.id]
      );
      user.is_followed = Boolean(follow);
    }

    // Phone is private: only the account owner may see it in the profile payload.
    // Contact reveal for other users goes through the dedicated /:id/phone endpoint.
    if (req.user?.id !== user.id) {
      user.phone = null;
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticated Call action (Section 3 & 8 & 71)
router.get('/:id/phone', requireAuth, async (req: AuthRequest, res) => {
  try {
    const targetUser = await queryOne<any>('SELECT phone, name FROM users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    if (!targetUser.phone) {
      return res.status(404).json({ error: 'Foydalanuvchi telefon raqamini kiritmagan' });
    }

    res.json({
      phone: targetUser.phone,
      name: targetUser.name,
      warning: "Shaxsiy ma’lumotlaringizni ulashishdan oldin ehtiyot bo‘ling. TopHand orqali yozish — xavfsizroq aloqa usuli.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile
router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, bio, region_id, district_id, profile_photo_url, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Ism kiritilishi shart' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE users 
       SET name = ?, bio = ?, region_id = COALESCE(?, region_id), district_id = COALESCE(?, district_id), 
           profile_photo_url = COALESCE(?, profile_photo_url),
           phone = COALESCE(?, phone), updated_at = ?
       WHERE id = ?`,
      [name.trim(), bio || null, region_id || null, district_id || null, profile_photo_url || null, phone || null, now, req.user!.id]
    );

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tasdiq nishoni (Verified badge): user self-service request ─────────────
// Foydalanuvchi pasport ma'lumoti + rasmini yuboradi → status PENDING
// (keyin moderator/admin tomonidan ko'rib chiqiladi).
router.post('/me/verification', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      full_legal_name,
      birth_date,
      passport_series,
      passport_number,
      pinfl,
      passport_issued_by,
      passport_issued_date,
      verification_photo_url,
    } = req.body || {};

    // Kiritilgan ma'lumotlarni tozalash
    const cleanName = (full_legal_name || '').trim();
    const cleanSeries = (passport_series || '').trim().toUpperCase();
    const cleanNumber = (passport_number || '').trim();
    const cleanPinfl = (pinfl || '').trim();

    if (!cleanName || cleanName.split(/\s+/).length < 2) {
      return res.status(400).json({ error: "To'liq ism familiya kamida 2 ta so'zdan iborat bo'lsin" });
    }
    if (!cleanSeries || !cleanNumber) {
      return res.status(400).json({ error: "Pasport seriyasi va raqami majburiy" });
    }
    if (!cleanPinfl || cleanPinfl.length !== 14 || /\D/.test(cleanPinfl)) {
      return res.status(400).json({ error: "PINFL 14 ta raqamdan iborat bo'lishi kerak" });
    }
    if (!verification_photo_url) {
      return res.status(400).json({ error: "Pasport rasmini (yoki o'zingizning selfie suratni) yuklang" });
    }

    const current = await queryOne<any>('SELECT verification_status FROM users WHERE id = ?', [req.user!.id]);
    if (current?.verification_status === 'VERIFIED') {
      return res.status(400).json({ error: "Sizning profilingiz allaqachon tasdiqlangan" });
    }
    if (current?.verification_status === 'PENDING') {
      return res.status(400).json({ error: "Arizangiz hozir ko'rib chiqilmoqda. Iltimos, kuting" });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE users SET
        full_legal_name = ?,
        birth_date = ?,
        passport_series = ?,
        passport_number = ?,
        pinfl = ?,
        passport_issued_by = ?,
        passport_issued_date = ?,
        verification_photo_url = ?,
        verification_status = 'PENDING',
        verification_rejection_reason = NULL,
        updated_at = ?
       WHERE id = ?`,
      [
        cleanName,
        (birth_date || '').trim() || null,
        cleanSeries,
        cleanNumber,
        cleanPinfl,
        (passport_issued_by || '').trim() || null,
        (passport_issued_date || '').trim() || null,
        verification_photo_url,
        now,
        req.user!.id,
      ]
    );

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Follow / Unfollow (Section 24)
router.post('/:id/follow', requireAuth, async (req: AuthRequest, res) => {
  try {
    const followerId = req.user!.id;
    const followedId = req.params.id;

    if (followerId === followedId) {
      return res.status(400).json({ error: "O'zingizga obuna bo'la olmaysiz" });
    }

    const targetUser = await queryOne('SELECT id, name FROM users WHERE id = ?', [followedId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const existing = await queryOne(
      'SELECT id FROM follows WHERE follower_user_id = ? AND followed_user_id = ?',
      [followerId, followedId]
    );

    const now = new Date().toISOString();

    if (existing) {
      await runQuery('DELETE FROM follows WHERE follower_user_id = ? AND followed_user_id = ?', [
        followerId,
        followedId,
      ]);
      return res.json({ followed: false });
    } else {
      const id = `fol_${crypto.randomUUID().slice(0, 16)}`;
      await runQuery(
        'INSERT INTO follows (id, follower_user_id, followed_user_id, created_at) VALUES (?, ?, ?, ?)',
        [id, followerId, followedId, now]
      );

      // Notification
      const follower = await queryOne<any>('SELECT name FROM users WHERE id = ?', [followerId]);
      const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
      await runQuery(
        `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
         VALUES (?, ?, 'FOLLOW_ACTIVITY', 'Yangi obunachi', ?, ?, ?)`,
        [
          notifId,
          followedId,
          `${follower?.name || 'Foydalanuvchi'} sizning profilingizga obuna bo'ldi.`,
          `/profile/${followerId}`,
          now,
        ]
      );

      return res.json({ followed: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get user followers
router.get('/:id/followers', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user?.id;

    const followers = await queryAll<any>(
      `SELECT 
        u.id, 
        u.name, 
        u.telegram_username, 
        u.profile_photo_url, 
        u.bio, 
        u.role, 
        u.verification_status, 
        r.name_uz as region_name, 
        d.name_uz as district_name,
        f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.follower_user_id = u.id
       LEFT JOIN regions r ON u.region_id = r.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE f.followed_user_id = ?
       ORDER BY f.created_at DESC`,
      [targetUserId]
    );

    let viewerFollowsSet = new Set<string>();
    if (currentUserId) {
      const viewerFollows = await queryAll<{ followed_user_id: string }>(
        'SELECT followed_user_id FROM follows WHERE follower_user_id = ?',
        [currentUserId]
      );
      viewerFollowsSet = new Set(viewerFollows.map((vf) => vf.followed_user_id));
    }

    const result = followers.map((u) => ({
      ...u,
      is_profile_complete: Boolean(u.profile_photo_url && (u.bio?.length || 0) >= 15),
      is_verified: u.verification_status === 'VERIFIED',
      is_followed_by_viewer: viewerFollowsSet.has(u.id),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get users that this user is following
router.get('/:id/following', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user?.id;

    const following = await queryAll<any>(
      `SELECT 
        u.id, 
        u.name, 
        u.telegram_username, 
        u.profile_photo_url, 
        u.bio, 
        u.role, 
        u.verification_status, 
        r.name_uz as region_name, 
        d.name_uz as district_name,
        f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.followed_user_id = u.id
       LEFT JOIN regions r ON u.region_id = r.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE f.follower_user_id = ?
       ORDER BY f.created_at DESC`,
      [targetUserId]
    );

    let viewerFollowsSet = new Set<string>();
    if (currentUserId) {
      const viewerFollows = await queryAll<{ followed_user_id: string }>(
        'SELECT followed_user_id FROM follows WHERE follower_user_id = ?',
        [currentUserId]
      );
      viewerFollowsSet = new Set(viewerFollows.map((vf) => vf.followed_user_id));
    }

    const result = following.map((u) => ({
      ...u,
      is_profile_complete: Boolean(u.profile_photo_url && (u.bio?.length || 0) >= 15),
      is_verified: u.verification_status === 'VERIFIED',
      is_followed_by_viewer: viewerFollowsSet.has(u.id),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get user listings (active, or archived if owner)
router.get('/:id/listings', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const targetUserId = req.params.id;
    const isOwner = req.user && req.user.id === targetUserId;
    const status = req.query.status as string;

    let sql = `
      SELECT 
        l.*,
        c.name_uz as category_name,
        r.name_uz as region_name,
        d.name_uz as district_name,
        (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order ASC LIMIT 1) as cover_image
      FROM listings l
      JOIN categories c ON l.category_id = c.id
      JOIN regions r ON l.region_id = r.id
      JOIN districts d ON l.district_id = d.id
      WHERE l.owner_user_id = ?
    `;
    const params: any[] = [targetUserId];

    if (!isOwner) {
      sql += " AND l.status = 'ACTIVE'";
    } else if (status === 'ARCHIVED') {
      // The owner's "Arxiv" tab also shows completed (closed) listings.
      sql += " AND l.status IN ('ARCHIVED', 'COMPLETED')";
    } else if (status) {
      sql += " AND l.status = ?";
      params.push(status);
    } else {
      sql += " AND l.status IN ('ACTIVE', 'ARCHIVED', 'HIDDEN', 'COMPLETED')";
    }

    sql += ' ORDER BY l.created_at DESC';

    const listings = await queryAll(sql, params);
    res.json(listings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
