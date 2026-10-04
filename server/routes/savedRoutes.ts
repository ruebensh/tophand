import { Router } from 'express';
import { requireAuth, AuthRequest } from '../auth/telegram.ts';
import { queryAll } from '../db/database.ts';

const router = Router();

// Get saved listings for current user
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const saved = await queryAll<any>(
      `SELECT 
        l.*,
        u.name as owner_name,
        u.telegram_username as owner_username,
        u.profile_photo_url as owner_photo_url,
        u.verification_status as owner_verification_status,
        u.role as owner_role,
        c.name_uz as category_name,
        r.name_uz as region_name,
        d.name_uz as district_name,
        (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order ASC LIMIT 1) as cover_image
       FROM saved_listings s
       JOIN listings l ON s.listing_id = l.id
       JOIN users u ON l.owner_user_id = u.id
       JOIN categories c ON l.category_id = c.id
       JOIN regions r ON l.region_id = r.id
       JOIN districts d ON l.district_id = d.id
       WHERE s.user_id = ?
         AND l.status <> 'COMPLETED'
       ORDER BY s.created_at DESC`,
      [req.user!.id]
    );

    // ListingCard `images` massiviga tayanadi — shuni to'ldiramiz.
    const ids = saved.map((l) => l.id);
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

    const result = saved.map((l) => ({
      ...l,
      images: imagesByListingId[l.id] || (l.cover_image ? [l.cover_image] : []),
      is_verified: l.owner_verification_status === 'VERIFIED',
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
