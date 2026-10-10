import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAuth, optionalAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, queryAll, runQuery } from '../db/database.ts';
import { sanitizeUserUrl } from '../lib/urlSecurity.ts';
import { processAndStoreVerificationImage, deleteStoredMedia } from '../services/storageService.ts';
import { deleteStoredMediaIfUnreferenced } from '../services/mediaCleanupService.ts';
import { purgeVerificationMedia } from '../services/moderationService.ts';
import { signVerificationPhotoUrl } from '../lib/signedUrl.ts';

const router = Router();

// P1-1/P1-2: dedicated, authenticated verification-image upload. Memory storage,
// strict single raster MIME + explicit multipart limits (mirrors uploadRoutes).
const verificationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1, fieldSize: 16 * 1024, parts: 4 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype.toLowerCase())) cb(null, true);
    else cb(new Error('Faqat rasm fayllari (JPEG, PNG, WebP, GIF) yuklanishi mumkin'));
  },
});

// Public user profile
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const user = await queryOne<any>(
      `SELECT 
        u.id, u.telegram_username, u.name, u.profile_photo_url, u.cover_photo_url, u.cover_gradient, u.bio, u.phone,
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

    res.json(user);
  } catch (err: any) {
    serverError(res, err);
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
    serverError(res, err);
  }
});

// Update profile
router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, bio, region_id, district_id, profile_photo_url, cover_photo_url, cover_gradient, phone } = req.body;
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: 'Ism kiritilishi shart' });
    }

    const now = new Date().toISOString();
    const newProfile = profile_photo_url !== undefined ? sanitizeUserUrl(profile_photo_url) : null;
    const newCover = cover_photo_url !== undefined ? sanitizeUserUrl(cover_photo_url) : null;
    // Eski havolalarni o'chirish uchun oldin qiymatni o'qib olamiz.
    const before = await queryOne<any>(
      'SELECT profile_photo_url, cover_photo_url FROM users WHERE id = ?',
      [req.user!.id]
    );
    await runQuery(
      `UPDATE users 
       SET name = COALESCE(?, name), 
           bio = COALESCE(?, bio), 
           region_id = COALESCE(?, region_id), 
           district_id = COALESCE(?, district_id), 
           profile_photo_url = COALESCE(?, profile_photo_url),
           cover_photo_url = COALESCE(?, cover_photo_url),
           cover_gradient = COALESCE(?, cover_gradient),
           phone = COALESCE(?, phone), 
           updated_at = ?
       WHERE id = ?`,
      [
        name !== undefined ? name.trim() : null,
        bio !== undefined ? bio : null,
        region_id !== undefined ? region_id : null,
        district_id !== undefined ? district_id : null,
        newProfile,
        newCover,
        cover_gradient !== undefined ? cover_gradient : null,
        phone !== undefined ? phone : null,
        now,
        req.user!.id,
      ]
    );

    // Tozalash: yangi rasm HAQIQIY almashtirilsa, eski faylni saqlagichdan
    // o'chiramiz (faqat bizniki; tashqi URL'lar deleteStoredMedia'da tashlanadi).
    // Report #3: profil/cover almashtirilganda eski faylni FAQAT boshqa yashovchi
    // qatorlar hali unga bog'lanmagan bo'lsa o'chiramiz (break-image oldini olish).
    if (newProfile && before?.profile_photo_url && before.profile_photo_url !== newProfile) {
      await deleteStoredMediaIfUnreferenced(before.profile_photo_url);
    }
    if (newCover && before?.cover_photo_url && before.cover_photo_url !== newCover) {
      await deleteStoredMediaIfUnreferenced(before.cover_photo_url);
    }

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    serverError(res, err);
  }
});

// ─── Parolni o'zgartirish (QA hisoboti P2) ──────────────────────────────
// ProfilePage formasidan: POST /api/users/change-password { currentPassword, newPassword }.
// Oldin bu endpoint YO'Q edi → 404. Bu yerda requireAuth bilan himoyalangan.
router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    // Yangi parol — server tomonida ham tekshiriladi (faqat client'ga ishonmaymiz).
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak" });
    }

    const user = await queryOne<any>('SELECT id, password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const hasPassword = Boolean(user.password_hash);

    if (hasPassword) {
      // Parol o'rnatilgan hisob: joriy parol majburiy va xeshga nisbatan tekshiriladi.
      if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ error: 'Joriy parolni kiriting' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: "Joriy parol noto'g'ri" });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'Yangi parol oldingisidan farq qilishi kerak' });
      }
    }
    // Parol o'rnatilmagan (Google/Telegram orqali ochilgan) hisob: foydalanuvchi
    // allaqachon autentifikangan — shuning uchun joriy parol talab qilinmaydi va
    // yangi parol o'rnatiladi (mos yo'l: "parolni qo'shish").

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();
    await runQuery('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      passwordHash,
      now,
      req.user!.id,
    ]);

    // Xavfsizlik: parol/esh hech qachon logga yoki javobga chiqmaydi.
    res.json({ success: true, password_set: true, created: !hasPassword });
  } catch (err: any) {
    serverError(res, err);
  }
});

// ─── Tasdiq nishoni (Verified badge): user self-service request ─────────────
// P1-1/P1-2 flow:
//   1) upload the passport/selfie via /me/verification/upload → stored PRIVATELY,
//      returns an opaque upload_id (never a raw public URL);
//   2) submit the application referencing ONLY that upload_id.
// The client can never inject an arbitrary photo URL, and ownership is enforced
// server-side (the object row must belong to the submitting user).

// 1) Verification image upload — authenticated, private storage → upload_id.
router.post('/me/verification/upload', requireAuth, verificationUpload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Rasm fayli tanlanmadi' });
    }
    const stored = await processAndStoreVerificationImage(req.file.buffer);
    const uploadId = `vup_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const createdAt = new Date().toISOString();
    await runQuery(
      `INSERT INTO verification_uploads (id, owner_user_id, purpose, object_key, media_type, created_at)
       VALUES (?, ?, 'verification', ?, 'image/webp', ?)`,
      [uploadId, req.user!.id, stored.objectKey, createdAt]
    );
    // Short-lived, owner-bound signed preview (proxy re-checks ownership on serve).
    const previewUrl = signVerificationPhotoUrl(stored.filename, req.user!.id);
    res.json({ upload_id: uploadId, preview_url: previewUrl });
  } catch (err: any) {
    serverError(res, err, 'Tasdiq rasmini yuklashda xatolik yuz berdi');
  }
});

// 2) Submit the verification application (references an owned upload_id only).
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
      verification_upload_id,
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
    // P1-2: refuse any client-supplied photo URL — only an upload_id obtained
    // from /me/verification/upload is accepted.
    if (verification_photo_url != null && String(verification_photo_url).trim() !== '') {
      return res.status(400).json({ error: 'verification_photo_url qabul qilinmaydi — rasmni /me/verification/upload orqali yuklang' });
    }
    if (!verification_upload_id) {
      return res.status(400).json({ error: "Pasport rasmini (yoki o'zingizning selfie suratni) yuklang" });
    }
    // Ownership: the referenced upload must exist AND belong to this user.
    const upload = await queryOne<any>(
      `SELECT object_key FROM verification_uploads WHERE id = ? AND owner_user_id = ?`,
      [verification_upload_id, req.user!.id]
    );
    if (!upload || !upload.object_key) {
      return res.status(403).json({ error: 'Yuklangan rasm topilmadi yoki sizga tegishli emas' });
    }

    const current = await queryOne<any>('SELECT verification_status FROM users WHERE id = ?', [req.user!.id]);
    if (current?.verification_status === 'VERIFIED') {
      return res.status(400).json({ error: "Sizning profilingiz allaqachon tasdiqlangan" });
    }
    if (current?.verification_status === 'PENDING') {
      return res.status(400).json({ error: "Arizangiz hozir ko'rib chiqilmoqda. Iltimos, kuting" });
    }

    const now = new Date().toISOString();
    // Report #6: eski fayllarni o'chirishni BINDING UPDATE MUVAFFAQIYATLI
    // bo'lganidan KEYIN bajaramiz (avval o'chirsak, UPDATE yiqilsa DB eski
    // havolani saqlab, fayl yo'q bo'lib qolardi). Bu yerda FAQAT o'qiymiz.
    const prior = await queryOne<any>('SELECT verification_photo_url FROM users WHERE id = ?', [req.user!.id]);
    const abandoned = await queryAll<{ object_key: string }>(
      'SELECT object_key FROM verification_uploads WHERE owner_user_id = ? AND id <> ?',
      [req.user!.id, verification_upload_id]
    );

    await runQuery(
      `UPDATE users SET
        full_legal_name = ?,
        birth_date = ?,
        passport_series = ?,
        passport_number = ?,
        pinfl = ?,
        passport_issued_by = ?,
        passport_issued_date = ?,
        verification_upload_id = ?,
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
        verification_upload_id,
        // Private object-key reference (NOT a servable public URL); serving goes
        // exclusively through the owner-bound signed proxy.
        upload.object_key,
        now,
        req.user!.id,
      ]
    );

    // UPDATE bo'ldi — endi eski/abandoned obyektlarni o'chiramiz (deleteStoredMedia
    // ichida durable-retry, shuning uchun throw qilmaydi).
    if (prior?.verification_photo_url && prior.verification_photo_url !== upload.object_key) {
      await deleteStoredMedia(prior.verification_photo_url);
    }
    await runQuery(
      'DELETE FROM verification_uploads WHERE owner_user_id = ? AND id <> ?',
      [req.user!.id, verification_upload_id]
    );
    for (const a of abandoned) {
      if (a.object_key && a.object_key !== upload.object_key) await deleteStoredMedia(a.object_key);
    }

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    serverError(res, err);
  }
});

// 3) Bekor qilish: foydalanuvchi FAQAT o'z PENDING arizasini qaytara oladi.
//    LEGAL (report #4): bekor qilinganda hujjat RASMI + rasmga oid havolalar
//    o'chiriladi; pasport MATN ma'lumotlari saqlanadi (holat UNVERIFIED).
router.post('/me/verification/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const me = await queryOne<any>('SELECT verification_status FROM users WHERE id = ?', [req.user!.id]);
    if (!me) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    if (me.verification_status !== 'PENDING') {
      return res.status(400).json({ error: 'Faqat ko‘rib chiqilayotgan (PENDING) arizani bekor qilish mumkin' });
    }
    // Rasm + verification_uploads qatorlari + ustun havolalari tozalanadi.
    await purgeVerificationMedia(req.user!.id);
    const now = new Date().toISOString();
    await runQuery(
      `UPDATE users SET verification_status = 'UNVERIFIED', verification_rejection_reason = NULL, updated_at = ? WHERE id = ?`,
      [now, req.user!.id]
    );
    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    serverError(res, err);
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
    serverError(res, err);
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
    serverError(res, err);
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
    serverError(res, err);
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

    const listings = await queryAll<any>(sql, params);

    // ListingCard `images` massiviga tayanadi — shuni to'ldiramiz.
    const ids = listings.map((l) => l.id);
    const imagesByListingId: Record<string, string[]> = {};
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const rows = await queryAll<{ listing_id: string; url: string }>(
        `SELECT listing_id, url FROM listing_images WHERE listing_id IN (${placeholders}) ORDER BY sort_order ASC`,
        ids
      );
      for (const r of rows) {
        (imagesByListingId[r.listing_id] ||= []).push(r.url);
      }
    }

    res.json(
      listings.map((l) => ({
        ...l,
        images: imagesByListingId[l.id] || (l.cover_image ? [l.cover_image] : []),
      }))
    );
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
