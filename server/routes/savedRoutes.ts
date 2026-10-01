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
       ORDER BY s.created_at DESC`,
      [req.user!.id]
    );

    const result = saved.map((l) => ({
      ...l,
      is_verified: l.owner_verification_status === 'VERIFIED',
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
