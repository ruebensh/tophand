import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, optionalAuth, isStaffRole, hasMinLevel, AuthRequest } from '../auth/telegram.ts';
import {
  searchListings,
  getListingById,
  createListing,
  renewListing,
  promoteListing,
  recordListingEvent,
  getListingStats,
} from '../services/listingService.ts';
import { autoFlagContentIfProfane, logSearchOrFilter } from '../services/autoModerationService.ts';
import { enqueueListing } from '../services/moderationAssignService.ts';
import { notifyFirstListing, createNotification } from '../services/notificationService.ts';
import { refundListingCreation } from '../services/walletService.ts';
import { queryOne, queryAll, runQuery } from '../db/database.ts';

const router = Router();

// Search and filter listings
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const workFormatQuery = req.query.work_format as string;
    const workFormats = workFormatQuery
      ? workFormatQuery.split(',').map((w) => w.trim()).filter(Boolean)
      : undefined;

    const expQuery = req.query.experience as string;
    const experiences = expQuery
      ? expQuery.split(',').map((e) => e.trim()).filter(Boolean)
      : undefined;

    // Structured attribute filters: `attr.<key>=<value>` query params.
    let attributeFilters: Record<string, string | number | boolean> | undefined;
    for (const [key, val] of Object.entries(req.query)) {
      if (!key.startsWith('attr.') || val === undefined || val === '') continue;
      if (!attributeFilters) attributeFilters = {};
      const attrKey = key.slice(5);
      const strVal = String(val);
      attributeFilters[attrKey] = /^-?\d+(\.\d+)?$/.test(strVal)
        ? Number(strVal)
        : strVal === 'true'
        ? true
        : strVal === 'false'
        ? false
        : strVal;
    }

    const filter = {
      catalog_id: (req.query.catalog_id as string) || undefined,
      type: (req.query.type as string) || undefined,
      category_id: (req.query.category_id as string) || undefined,
      region_id: (req.query.region_id as string) || undefined,
      district_id: (req.query.district_id as string) || undefined,
      keyword: (req.query.keyword as string) || undefined,
      price_type: (req.query.price_type as string) || undefined,
      price_min: req.query.price_min ? parseFloat(req.query.price_min as string) : undefined,
      price_max: req.query.price_max ? parseFloat(req.query.price_max as string) : undefined,
      salary_min: req.query.salary_min ? parseFloat(req.query.salary_min as string) : undefined,
      salary_max: req.query.salary_max ? parseFloat(req.query.salary_max as string) : undefined,
      work_format: (req.query.work_format as string) || undefined,
      work_formats: workFormats,
      experience: experiences,
      attributes: attributeFilters,
      sort_by: (req.query.sort_by as string) || undefined,
      user_lat: req.query.user_lat ? parseFloat(req.query.user_lat as string) : undefined,
      user_lng: req.query.user_lng ? parseFloat(req.query.user_lng as string) : undefined,
      max_distance_km: req.query.max_distance_km
        ? parseFloat(req.query.max_distance_km as string)
        : undefined,
      only_followed: req.query.only_followed === 'true',
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 12,
      current_user_id: req.user?.id,
    };

    const results = await searchListings(filter);

    // Track search and filter usage for admin statistics
    if (filter.category_id) {
      logSearchOrFilter({ event_type: 'CATEGORY_FILTER', category_id: filter.category_id, filter_type: 'CATEGORY', user_id: req.user?.id });
    }
    if (filter.keyword) {
      logSearchOrFilter({ event_type: 'SEARCH_KEYWORD', keyword: filter.keyword, user_id: req.user?.id });
    }
    if (filter.price_min || filter.price_max) {
      logSearchOrFilter({ event_type: 'FILTER_USE', filter_type: 'MAOSH_PRICE', filter_value: 'price_filter', user_id: req.user?.id });
    }
    if (filter.region_id) {
      logSearchOrFilter({ event_type: 'FILTER_USE', filter_type: 'HUDUD', filter_value: filter.district_id || filter.region_id, user_id: req.user?.id });
    }
    if (filter.work_format) {
      logSearchOrFilter({ event_type: 'FILTER_USE', filter_type: 'ISH_TURI', filter_value: filter.work_format, user_id: req.user?.id });
    }
    if (filter.only_followed) {
      logSearchOrFilter({ event_type: 'FILTER_USE', filter_type: 'OBUNALARIM', filter_value: 'only_followed', user_id: req.user?.id });
    }

    res.json(results);
  } catch (err: any) {
    console.error('Listings search error:', err);
    res.status(500).json({ error: err.message || 'E’lonlarni yuklashda xatolik yuz berdi' });
  }
});

// Get single listing detail
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await getListingById(req.params.id, req.user?.id);
    if (!listing) {
      return res.status(404).json({ error: 'E’lon topilmadi' });
    }

    // If listing is not active, allow only owner, moderator, or admin to view
    if (listing.status !== 'ACTIVE') {
      const isOwner = req.user?.id === listing.owner_user_id;
      const isStaff = isStaffRole(req.user?.role);
      if (!isOwner && !isStaff) {
        return res.status(404).json({ error: 'Ushbu e’lon faol emas yoki arxivlangan' });
      }
    }

    // Faza 9: track VIEW event (skip owner self-views)
    if (req.user?.id !== listing.owner_user_id) {
      recordListingEvent(listing.id, 'VIEW', req.user?.id || null).catch(() => {});
    }

    res.json(listing);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new listing (Section 40 & 41: immediately ACTIVE, 30 days expiration)
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      type,
      catalog_id,
      title,
      description,
      category_id,
      region_id,
      district_id,
      latitude,
      longitude,
      price_type,
      price_min,
      price_max,
      salary_type,
      salary_min,
      salary_max,
      work_format,
      experience_level,
      skills,
      contact_time,
      contact_custom_text,
      organization_id,
      attributes,
      images,
      videos,
    } = req.body;

    // Validation
    const allowedTypes = [
      'SELL', 'WANTED', 'RENT_OUT', 'RENT_WANTED',
      'SERVICE_OFFER', 'SERVICE_REQUEST', 'JOB_OPENING', 'JOB_SEEKER',
    ];
    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'E’lon turi noto‘g‘ri tanlangan' });
    }

    if (!title || title.trim().length < 5) {
      return res.status(400).json({ error: 'E’lon sarlavhasi kamida 5 ta belgidan iborat bo‘lishi kerak' });
    }

    // Auto-generate description if omitted or short (user doesn't need to manually type essays)
    let finalDescription = (description || '').trim();
    if (finalDescription.length < 15) {
      const skillsPart = Array.isArray(skills) && skills.length > 0 ? ` Xususiyatlar: ${skills.join(', ')}.` : '';
      finalDescription = `${title.trim()}.${skillsPart} Sifatli xizmat, ishonchli ijro va qulay shartlar.`;
    }

    if (!category_id) {
      return res.status(400).json({ error: 'Kategoriya tanlanishi shart' });
    }

    if (!region_id || !district_id) {
      return res.status(400).json({ error: 'Viloyat va tuman kiritilishi shart' });
    }

    // If posting as an organization, check membership
    if (organization_id) {
      const membership = await queryOne(
        'SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ?',
        [organization_id, req.user!.id]
      );
      if (!membership) {
        return res.status(403).json({ error: 'Siz ushbu tashkilot nomidan e’lon berish huquqiga ega emassiz' });
      }
    }

    const listing = await createListing(req.user!.id, {
      type,
      catalog_id,
      title,
      description: finalDescription,
      category_id,
      region_id,
      district_id,
      latitude,
      longitude,
      price_type: price_type || 'NEGOTIABLE',
      price_min,
      price_max,
      salary_type,
      salary_min,
      salary_max,
      work_format,
      experience_level,
      skills,
      contact_time,
      contact_custom_text,
      organization_id,
      attributes: attributes && typeof attributes === 'object' ? attributes : {},
      images: Array.isArray(images) ? images : [],
      videos: Array.isArray(videos) ? videos : [],
    });

    // Debut milestone: congratulate the owner on publishing their very first listing.
    try {
      const cnt = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM listings WHERE owner_user_id = ?',
        [req.user!.id]
      );
      if (Number(cnt?.count || 0) === 1) {
        notifyFirstListing(req.user!.id, listing.title).catch(() => {});
      }
    } catch (e) {
      console.error('First-listing milestone check failed:', e);
    }

    // Notify all followers about this new listing
    try {
      const followers = await queryAll<{ follower_user_id: string }>(
        'SELECT follower_user_id FROM follows WHERE followed_user_id = ?',
        [req.user!.id]
      );
      const ownerName = req.user!.name || 'Siz obuna bo‘lgan mutaxassis';
      const now = new Date().toISOString();
      for (const f of followers) {
        const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
        await runQuery(
          `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
           VALUES (?, ?, 'NEW_LISTING_FROM_FOLLOWED', ?, ?, ?, ?)`,
          [
            notifId,
            f.follower_user_id,
            `${ownerName} yangi e’lon joyladi`,
            `${ownerName} yangi e’lon berdi: "${listing.title}"`,
            `/listing/${listing.id}`,
            now,
          ]
        );
      }
    } catch (notifErr) {
      console.error('Failed to notify followers:', notifErr);
    }

    // Auto-scan content for profanity
    autoFlagContentIfProfane(
      'LISTING',
      listing.id,
      req.user!.id,
      `${listing.title} ${listing.description}`
    );

    // Faza 17: enqueue for moderation distribution (auto-approve if clean + enabled)
    enqueueListing(listing.id).catch(() => {});

    res.status(201).json(listing);
  } catch (err: any) {
    console.error('Error creating listing:', err);
    res.status(500).json({ error: err.message });
  }
});

// Edit listing
router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = req.params.id;
    const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [listingId]);
    if (!listing) {
      return res.status(404).json({ error: 'E’lon topilmadi' });
    }

    const isOwner = listing.owner_user_id === req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Faqat e’lon egasi o‘zgartirish kiritishi mumkin' });
    }

    const {
      title,
      description,
      category_id,
      region_id,
      district_id,
      price_type,
      price_min,
      price_max,
      salary_type,
      salary_min,
      salary_max,
      work_format,
      experience_level,
      skills,
      contact_time,
      contact_custom_text,
      attributes,
      images,
      videos,
    } = req.body;

    // Admin-only moderation fields (audit logged)
    const isAdminEditor = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
    const status = isAdminEditor ? req.body.status : undefined;

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE listings 
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           category_id = COALESCE(?, category_id),
           region_id = COALESCE(?, region_id),
           district_id = COALESCE(?, district_id),
           price_type = COALESCE(?, price_type),
           price_min = ?,
           price_max = ?,
           salary_type = ?,
           salary_min = ?,
           salary_max = ?,
           work_format = COALESCE(?, work_format),
           experience_level = ?,
           skills = ?,
           contact_time = COALESCE(?, contact_time),
           contact_custom_text = ?,
           attributes = COALESCE(?::jsonb, attributes),
           status = COALESCE(?, status),
           updated_at = ?
       WHERE id = ?`,
      [
        title ? title.trim() : null,
        description ? description.trim() : null,
        category_id || null,
        region_id || null,
        district_id || null,
        price_type || null,
        price_min ?? null,
        price_max ?? null,
        salary_type || null,
        salary_min ?? null,
        salary_max ?? null,
        work_format || null,
        experience_level || null,
        skills ? JSON.stringify(skills) : null,
        contact_time || null,
        contact_custom_text || null,
        attributes && typeof attributes === 'object' ? JSON.stringify(attributes) : null,
        status || null,
        now,
        listingId,
      ]
    );

    // Update media (images + videos) if either provided
    if (Array.isArray(images) || Array.isArray(videos)) {
      const imageList = Array.isArray(images) ? images : [];
      const videoList = Array.isArray(videos) ? videos : [];
      const media = [...imageList.slice(0, 8), ...videoList.slice(0, 2)];
      await runQuery('DELETE FROM listing_images WHERE listing_id = ?', [listingId]);
      for (let i = 0; i < media.length; i++) {
        const url = media[i];
        const mediaType = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? 'video' : 'image';
        const imgId = `img_${crypto.randomUUID().slice(0, 16)}`;
        await runQuery(
          'INSERT INTO listing_images (id, listing_id, url, sort_order, media_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [imgId, listingId, url, i, mediaType, now]
        );
      }
    }

    if (isAdminEditor) {
      try {
        await runQuery(
          `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
           VALUES (?, ?, 'ADMIN_EDIT_LISTING', 'LISTING', ?, ?, ?)`,
          [`audit_${crypto.randomUUID().slice(0, 16)}`, req.user!.id, listingId, JSON.stringify({ title, status, role: req.user!.role }), now]
        );
      } catch (auditErr) {
        console.error('Failed to audit admin listing edit:', auditErr);
      }
    }

    const updated = await getListingById(listingId, req.user!.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Renew listing (Section 12: extends by 30 days, does NOT alter created_at)
router.post('/:id/renew', requireAuth, async (req: AuthRequest, res) => {
  try {
    const renewed = await renewListing(req.params.id, req.user!.id);
    res.json({ success: true, listing: renewed });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Mark a listing as completed — the request/task was fulfilled (e.g. a plumbing
// job is done). The listing is closed and moved to the owner's archive (COMPLETED),
// and both the owner and everyone who reached out are notified.
router.post('/:id/complete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'E’lon topilmadi' });

    if (listing.owner_user_id !== req.user!.id && !hasMinLevel(req.user!.role, 'ADMIN')) {
      return res.status(403).json({ error: 'Faqat e’lon egasi yakunlashi mumkin' });
    }

    if (listing.status === 'COMPLETED') {
      return res.json({ success: true, status: 'COMPLETED', message: 'E’lon allaqachon yakunlangan' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE listings SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, listing.id]
    );

    // Yakunlangan e'lon yoqtirilganlar ro'yxatidan chiqib ketadi — saqlangan
    // (saved) yozuvlarni tozalaymiz.
    await runQuery(`DELETE FROM saved_listings WHERE listing_id = ?`, [listing.id]).catch(() => {});

    // Notify the owner (signed by the TopHand team).
    createNotification({
      userId: listing.owner_user_id,
      type: 'LISTING_COMPLETED',
      title: 'E’loningiz yakunlandi ✅',
      body:
        `"${listing.title}" e’loningiz muvaffaqiyatli amalga oshgan deb belgilandi va yopildi (arxivga o'tdi). ` +
        `Yangi xohishingiz bo'lsa, istalgan vaqtda uni qayta faollashtirishingiz mumkin.`,
      link: `/listing/${listing.id}`,
    }).catch(() => {});

    // Notify everyone who reached out about this listing (both chat sides), minus the owner.
    try {
      const contacts = await queryAll<{ user_id: string }>(
        `SELECT DISTINCT initiator_user_id AS user_id FROM conversations WHERE listing_id = ? AND initiator_user_id <> ?
         UNION
         SELECT DISTINCT recipient_user_id AS user_id FROM conversations WHERE listing_id = ? AND recipient_user_id <> ?`,
        [listing.id, listing.owner_user_id, listing.id, listing.owner_user_id]
      );
      for (const c of contacts) {
        await createNotification({
          userId: c.user_id,
          type: 'LISTING_COMPLETED',
          title: 'Bog’langan e’lon yakunlandi',
          body:
            `Siz murojaat qilgan "${listing.title}" e’loni bajarilgan holda yopildi. ` +
            `Agar uchrashuvda bo'lgan bo'lsangiz, ijodkorga baho qoldirishingiz mumkin. Rahmat!`,
          link: `/listing/${listing.id}`,
        });
      }
    } catch (e) {
      console.error('Failed to notify listing contacts on completion:', e);
    }

    res.json({ success: true, status: 'COMPLETED' });
  } catch (err: any) {
    console.error('Complete listing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Faza 8: Promote listing to the top (charge from wallet when PAID)
router.post('/:id/promote', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await promoteListing(req.params.id, req.user!.id);
    res.json({ success: true, listing });
  } catch (err: any) {
    const status = err?.name === 'InsufficientFundsError' ? 402 : 400;
    res.status(status).json({ error: err.message, code: err?.name });
  }
});

// Faza 9 + bug fix: Reveal owner phone (was broken /contact) + track CONTACT event
const contactHandler = async (req: AuthRequest, res: Response) => {
  try {
    const listing = await queryOne<any>('SELECT owner_user_id FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'E’lon topilmadi' });

    const owner = await queryOne<{ phone: string }>('SELECT phone FROM users WHERE id = ?', [listing.owner_user_id]);
    if (!owner || !owner.phone) {
      return res.status(404).json({ error: 'Telefon raqami mavjud emas' });
    }

    if (req.user!.id !== listing.owner_user_id) {
      recordListingEvent(req.params.id, 'CONTACT', req.user!.id).catch(() => {});
    }
    res.json({ phone: owner.phone });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
router.get('/:id/contact', requireAuth, contactHandler);
router.post('/:id/contact', requireAuth, contactHandler);

// Faza 9: Listing analytics — owner or staff only
router.get('/:id/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await queryOne<any>('SELECT owner_user_id FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'E’lon topilmadi' });

    const isOwner = req.user!.id === listing.owner_user_id;
    const isStaff = isStaffRole(req.user!.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Faqat e’lon egasi yoki xodim ko’ra oladi' });
    }

    const stats = await getListingStats(req.params.id);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle hide / active
router.post('/:id/toggle-hide', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'E’lon topilmadi' });

    if (listing.owner_user_id !== req.user!.id && !hasMinLevel(req.user!.role, 'ADMIN')) {
      return res.status(403).json({ error: 'Ruxsat berilmadi' });
    }

    const newStatus = listing.status === 'ACTIVE' ? 'HIDDEN' : 'ACTIVE';
    const now = new Date().toISOString();
    await runQuery('UPDATE listings SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, listing.id]);

    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete / Remove listing
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'E’lon topilmadi' });

    if (listing.owner_user_id !== req.user!.id && !hasMinLevel(req.user!.role, 'ADMIN')) {
      return res.status(403).json({ error: 'Ruxsat berilmadi' });
    }

    const now = new Date().toISOString();
    const hard = req.query.hard === 'true' && hasMinLevel(req.user!.role, 'ADMIN');

    if (hard) {
      await runQuery('DELETE FROM listing_images WHERE listing_id = ?', [listing.id]);
      await runQuery('DELETE FROM saved_listings WHERE listing_id = ?', [listing.id]);
      await runQuery('DELETE FROM listings WHERE id = ?', [listing.id]);

      const auditId = `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await runQuery(
        `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
         VALUES (?, ?, 'LISTING_HARD_DELETED_BY_ADMIN', 'LISTING', ?, ?, ?)`,
        [auditId, req.user!.id, listing.id, JSON.stringify({ title: listing.title, owner: listing.owner_user_id }), now]
      );

      return res.json({ success: true, hard: true, message: 'E’lon bazadan butunlay o‘chirib yuborildi' });
    }

    await runQuery("UPDATE listings SET status = 'REMOVED', updated_at = ? WHERE id = ?", [now, listing.id]);

    if (hasMinLevel(req.user!.role, 'ADMIN')) {
      const auditId = `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await runQuery(
        `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
         VALUES (?, ?, 'LISTING_REMOVED_BY_ADMIN', 'LISTING', ?, ?, ?)`,
        [auditId, req.user!.id, listing.id, JSON.stringify({ title: listing.title, owner: listing.owner_user_id }), now]
      );

      // Staff/admin removal of a paid listing → refund the one-time creation charge once.
      try { await refundListingCreation(listing.id); } catch (e) { console.error('Listing refund on removal failed:', e); }
    }

    res.json({ success: true, message: 'E’lon olib tashlandi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save / Unsave listing (Section 25)
router.post('/:id/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const listingId = req.params.id;

    const existing = await queryOne(
      'SELECT id FROM saved_listings WHERE user_id = ? AND listing_id = ?',
      [userId, listingId]
    );

    if (existing) {
      await runQuery('DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?', [
        userId,
        listingId,
      ]);
      return res.json({ saved: false });
    } else {
      const id = `sav_${crypto.randomUUID().slice(0, 16)}`;
      const now = new Date().toISOString();
      await runQuery(
        'INSERT INTO saved_listings (id, user_id, listing_id, created_at) VALUES (?, ?, ?, ?)',
        [id, userId, listingId, now]
      );
      return res.json({ saved: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
