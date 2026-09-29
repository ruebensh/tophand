import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, optionalAuth, AuthRequest } from '../auth/telegram.ts';
import {
  searchListings,
  getListingById,
  createListing,
  renewListing,
} from '../services/listingService.ts';
import { autoFlagContentIfProfane, logSearchOrFilter } from '../services/autoModerationService.ts';
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

    const filter = {
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
      const isStaff = req.user?.role === 'MODERATOR' || req.user?.role === 'ADMIN';
      if (!isOwner && !isStaff) {
        return res.status(404).json({ error: 'Ushbu e’lon faol emas yoki arxivlangan' });
      }
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
      images,
    } = req.body;

    // Validation
    const allowedTypes = ['SERVICE_OFFER', 'SERVICE_REQUEST', 'JOB_OPENING', 'JOB_SEEKER'];
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
      images: Array.isArray(images) ? images : [],
    });

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
      images,
    } = req.body;

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
        now,
        listingId,
      ]
    );

    // Update images if provided
    if (Array.isArray(images)) {
      await runQuery('DELETE FROM listing_images WHERE listing_id = ?', [listingId]);
      for (let i = 0; i < Math.min(images.length, 8); i++) {
        const imgId = `img_${crypto.randomUUID().slice(0, 16)}`;
        await runQuery(
          'INSERT INTO listing_images (id, listing_id, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
          [imgId, listingId, images[i], i, now]
        );
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

// Toggle hide / active
router.post('/:id/toggle-hide', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!listing) return res.status(404).json({ error: 'E’lon topilmadi' });

    if (listing.owner_user_id !== req.user!.id && req.user!.role !== 'ADMIN') {
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

    if (listing.owner_user_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Ruxsat berilmadi' });
    }

    const now = new Date().toISOString();
    const hard = req.query.hard === 'true' && req.user!.role === 'ADMIN';

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

    if (req.user!.role === 'ADMIN') {
      const auditId = `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await runQuery(
        `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
         VALUES (?, ?, 'LISTING_REMOVED_BY_ADMIN', 'LISTING', ?, ?, ?)`,
        [auditId, req.user!.id, listing.id, JSON.stringify({ title: listing.title, owner: listing.owner_user_id }), now]
      );
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
