import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole, AuthRequest } from '../auth/telegram.ts';
import {
  getAdminOverview,
  adminPermanentBan,
  adminUnban,
  adminSetRole,
  adminVerifyOrganization,
} from '../services/moderationService.ts';
import { getAdvancedAnalytics } from '../services/autoModerationService.ts';
import { queryAll, queryOne, runQuery, persistDb } from '../db/database.ts';
import { processAndStoreLogo } from '../services/storageService.ts';
import { getMonetizationConfig, setSetting } from '../services/monetizationService.ts';
import { isSupportedEntity, exportToXlsx, importFromXlsx } from '../services/exportService.ts';

const router = Router();

// Configure multer memory storage for strict atomic PNG logo processing
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.png') {
      return cb(new Error("Faqat .png formatidagi fayllar qabul qilinadi. Boshqa formatlar (JPG, JPEG, SVG, WebP, GIF) taqiqlanadi."));
    }
    if (file.mimetype !== 'image/png') {
      return cb(new Error("Faqat 'image/png' MIME turi qabul qilinadi."));
    }
    cb(null, true);
  },
});

// Middleware: Admin only for all routes in this file
router.use(requireAuth, requireRole(['ADMIN']));

// Overview stats (Section 34)
router.get('/overview', async (_req, res) => {
  try {
    const stats = await getAdminOverview();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Users management
router.get('/users', async (req, res) => {
  try {
    const search = req.query.search as string;
    const role = req.query.role as string;
    let sql = `
      SELECT 
        u.*,
        r.name_uz as region_name,
        d.name_uz as district_name,
        (SELECT COUNT(*) FROM listings WHERE owner_user_id = u.id) as listings_count
      FROM users u
      LEFT JOIN regions r ON u.region_id = r.id
      LEFT JOIN districts d ON u.district_id = d.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (search && search.trim()) {
      conditions.push('(LOWER(u.name) LIKE ? OR LOWER(u.telegram_username) LIKE ? OR u.telegram_id LIKE ?)');
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    if (role) {
      conditions.push('u.role = ?');
      params.push(role);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY u.created_at DESC LIMIT 100';

    const users = await queryAll(sql, params);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Permanent ban (Section 35: Admin only)
router.post('/users/:id/ban', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Bloklash sababi ko‘rsatilishi shart' });
    }

    const result = await adminPermanentBan(req.user!.id, req.params.id, reason);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Unban user
router.post('/users/:id/unban', async (req: AuthRequest, res) => {
  try {
    const result = await adminUnban(req.user!.id, req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Set user role (Add/remove moderator)
router.post('/users/:id/role', async (req: AuthRequest, res) => {
  try {
    const { role } = req.body;
    if (role !== 'USER' && role !== 'MODERATOR') {
      return res.status(400).json({ error: 'Faqat USER yoki MODERATOR roli o‘rnatilishi mumkin' });
    }

    const result = await adminSetRole(req.user!.id, req.params.id, role);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Organization verification
router.post('/organizations/:id/verify', async (req: AuthRequest, res) => {
  try {
    const { verify } = req.body;
    const result = await adminVerifyOrganization(req.user!.id, req.params.id, Boolean(verify));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all organizations for admin
router.get('/organizations', async (_req, res) => {
  try {
    const orgs = await queryAll(
      `SELECT o.*, u.name as owner_name, u.telegram_username as owner_username 
       FROM organizations o
       JOIN users u ON o.owner_user_id = u.id
       ORDER BY o.created_at DESC`
    );
    res.json(orgs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Category management: Create
router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const { name_uz, slug, icon, catalog_id, parent_id, sort_order } = req.body;
    if (!name_uz || !slug) {
      return res.status(400).json({ error: 'Nomi va slug kiritilishi shart' });
    }

    const id = `cat_${slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO categories (id, catalog_id, name_uz, slug, icon, parent_id, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [id, catalog_id || 'services', name_uz.trim(), slug.trim(), icon || 'Briefcase', parent_id || null, sort_order || 0, now, now]
    );

    const created = await queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Category management: Update/Toggle
router.put('/categories/:id', async (req: AuthRequest, res) => {
  try {
    const { name_uz, slug, icon, catalog_id, parent_id, is_active, sort_order } = req.body;
    const now = new Date().toISOString();

    await runQuery(
      `UPDATE categories 
       SET name_uz = COALESCE(?, name_uz),
           slug = COALESCE(?, slug),
           icon = COALESCE(?, icon),
           catalog_id = COALESCE(?, catalog_id),
           parent_id = COALESCE(?, parent_id),
           is_active = COALESCE(?, is_active),
           sort_order = COALESCE(?, sort_order),
           updated_at = ?
       WHERE id = ?`,
      [
        name_uz || null,
        slug || null,
        icon || null,
        catalog_id || null,
        parent_id !== undefined ? parent_id : null,
        is_active !== undefined ? is_active : null,
        sort_order !== undefined ? sort_order : null,
        now,
        req.params.id
      ]
    );

    const updated = await queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit logs
router.get('/audit-logs', async (_req, res) => {
  try {
    const logs = await queryAll(
      `SELECT a.*, u.name as actor_name, u.role as actor_role 
       FROM audit_logs a
       JOIN users u ON a.actor_user_id = u.id
       ORDER BY a.created_at DESC LIMIT 100`
    );
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logo Management: GET current active logo details
router.get('/logo', async (_req, res) => {
  try {
    const setting = await queryOne<{ value: string; updated_at: string; updated_by?: string }>(
      'SELECT value, updated_at, updated_by FROM system_settings WHERE key = ?',
      ['active_logo_url']
    );

    const logoUrl = setting?.value || '/TOPHAND.uz (1).png';
    const updatedAt = setting?.updated_at || new Date().toISOString();

    let updaterName = 'Tizim (Standart)';
    if (setting?.updated_by) {
      const user = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [setting.updated_by]);
      if (user) updaterName = user.name;
    }

    const fileDetails: { width?: number; height?: number; size?: number; hasAlpha?: boolean } = {};
    try {
      let localPath = '';
      if (logoUrl.startsWith('/uploads/')) {
        localPath = path.resolve(process.cwd(), logoUrl.replace(/^\//, ''));
      } else if (logoUrl.startsWith('/')) {
        localPath = path.resolve(process.cwd(), 'public', logoUrl.replace(/^\//, ''));
      }
      if (fs.existsSync(localPath)) {
        const stats = await fs.promises.stat(localPath);
        fileDetails.size = stats.size;
        const meta = await sharp(localPath).metadata();
        fileDetails.width = meta.width;
        fileDetails.height = meta.height;
        fileDetails.hasAlpha = meta.hasAlpha;
      }
    } catch (e) {
      console.warn('Could not read logo metadata from disk:', e);
    }

    const lastAudit = await queryOne(
      "SELECT a.*, u.name as actor_name FROM audit_logs a JOIN users u ON a.actor_user_id = u.id WHERE a.action = 'UPDATE_LOGO' ORDER BY a.created_at DESC LIMIT 1"
    );

    res.json({
      logo_url: logoUrl,
      updated_at: updatedAt,
      updated_by: setting?.updated_by || null,
      updater_name: updaterName,
      version: new Date(updatedAt).getTime().toString(),
      ...fileDetails,
      last_audit: lastAudit || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logo Management: POST new PNG logo (Admin only, strict validation)
router.post('/logo', (req: AuthRequest, res, next) => {
  logoUpload.single('logo')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Faylni yuklashda xatolik yuz berdi' });
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Hech qanday logo fayli tanlanmadi' });
    }

    // 1. Strict size check (5 MB maximum)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return res.status(400).json({ error: 'Fayl hajmi 5 MB dan oshmasligi kerak' });
    }

    // 2. Strict file extension check (.png only)
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.png') {
      return res.status(400).json({
        error: "Faqat .png formatidagi fayllar qabul qilinadi. Boshqa formatlar (JPG, JPEG, SVG, WebP, GIF) taqiqlanadi.",
      });
    }

    // 3. Strict MIME type check
    if (file.mimetype !== 'image/png') {
      return res.status(400).json({
        error: "Noto'g'ri fayl formati. Faqat 'image/png' qabul qilinadi.",
      });
    }

    // 4. Magic bytes verification (PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A)
    if (
      file.buffer.length < 8 ||
      file.buffer[0] !== 0x89 ||
      file.buffer[1] !== 0x50 ||
      file.buffer[2] !== 0x4e ||
      file.buffer[3] !== 0x47 ||
      file.buffer[4] !== 0x0d ||
      file.buffer[5] !== 0x0a ||
      file.buffer[6] !== 0x1a ||
      file.buffer[7] !== 0x0a
    ) {
      return res.status(400).json({
        error: "Fayl haqiqiy PNG formati imzolariga (magic bytes) ega emas. Buzilgan yoki soxta fayl.",
      });
    }

    // 5. Image decoding and integrity verification via Sharp
    let metadata;
    try {
      metadata = await sharp(file.buffer).metadata();
    } catch (decodeErr: any) {
      return res.status(400).json({
        error: "Fayl rasm ma'lumotlarini dekodlashda xatolik. Haqiqiy va buzilmagan PNG fayl yuklang.",
      });
    }

    if (metadata.format !== 'png') {
      return res.status(400).json({
        error: "Rasmning ichki formati PNG emas.",
      });
    }

    if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
      return res.status(400).json({
        error: "Rasm o'lchamlari yaroqsiz.",
      });
    }

    // 6. Process and store logo (Cloudflare R2 or local storage)
    const logoResult = await processAndStoreLogo(file.buffer, file.originalname);
    const relativeUrl = logoResult.url;
    const now = new Date().toISOString();

    const prevSetting = await queryOne<{ value: string }>(
      'SELECT value FROM system_settings WHERE key = ?',
      ['active_logo_url']
    );
    const previousUrl = prevSetting?.value || '/TOPHAND.uz (1).png';

    await runQuery(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('active_logo_url', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [relativeUrl, now, req.user!.id]
    );

    // Also sync logo_url directly into platform_brand configuration
    const currentBrandSetting = await queryOne<{ value: string }>(
      'SELECT value FROM system_settings WHERE key = ?',
      ['platform_brand']
    );
    let brandObj: any = {
      prefix_text: 'top',
      prefix_color: '#111827',
      suffix_text: 'hand',
      suffix_color: '#1673E6',
      domain_suffix: '.uz',
      domain_color: '#1673E6',
      tagline: 'Mahalliy Xizmatlar va Ish Bozori Platformasi',
      logo_url: relativeUrl,
    };
    if (currentBrandSetting?.value) {
      try {
        brandObj = { ...brandObj, ...JSON.parse(currentBrandSetting.value), logo_url: relativeUrl };
      } catch (e) {}
    }
    await runQuery(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('platform_brand', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [JSON.stringify(brandObj), now, req.user!.id]
    );

    // 8. Record administrator logo replacement event in audit log
    const auditId = `audit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        auditId,
        req.user!.id,
        'UPDATE_LOGO',
        'SYSTEM',
        'logo',
        JSON.stringify({
          previous_logo_url: previousUrl,
          new_logo_url: relativeUrl,
          original_filename: file.originalname,
          file_size: file.size,
          width: metadata.width,
          height: metadata.height,
          has_alpha: metadata.hasAlpha,
        }),
        now,
      ]
    );

    await persistDb();

    res.json({
      success: true,
      message: 'Logotip muvaffaqiyatli yuklandi va yangilandi',
      logo_url: relativeUrl,
      version: Date.now().toString(),
      width: metadata.width,
      height: metadata.height,
      size: file.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Logotipni saqlashda xatolik yuz berdi' });
  }
});

// Advanced Analytics endpoint
router.get('/analytics', async (_req, res) => {
  try {
    const data = await getAdvancedAnalytics();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User verification management (Approve or Reject verification)
router.put('/users/:id/verification', async (req: AuthRequest, res) => {
  try {
    const { status, rejection_reason } = req.body;
    const targetUserId = req.params.id;
    const now = new Date().toISOString();

    if (status === 'VERIFIED') {
      await runQuery(
        `UPDATE users SET 
          verification_status = 'VERIFIED',
          verified_at = ?,
          verified_by = ?,
          verification_rejection_reason = NULL,
          updated_at = ?
         WHERE id = ?`,
        [now, req.user!.id, now, targetUserId]
      );

      // Send congratulations notification
      const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
      await runQuery(
        `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
         VALUES (?, ?, 'SYSTEM_ALERT', 'Shaxsingiz tasdiqlandi!', 'Tabriklaymiz! Sizning pasport ma’lumotlaringiz ma’muriyat tomonidan tekshirilib, profilingizga rasmiy tasdiq nishoni (Verified badge) berildi.', '/profile/${targetUserId}', ?)`,
        [notifId, targetUserId, now]
      );
    } else if (status === 'REJECTED') {
      await runQuery(
        `UPDATE users SET 
          verification_status = 'REJECTED',
          verification_rejection_reason = ?,
          verified_at = NULL,
          updated_at = ?
         WHERE id = ?`,
        [rejection_reason || 'Taqdim etilgan ma’lumotlar talablarga to‘liq mos kelmadi', now, targetUserId]
      );

      const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
      await runQuery(
        `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
         VALUES (?, ?, 'SYSTEM_ALERT', 'Tasdiqlash arizasi rad etildi', ?, '/profile/${targetUserId}', ?)`,
        [notifId, targetUserId, `Tasdiqlash arizangiz rad etildi. Sabab: ${rejection_reason || 'Hujjatlarda noaniqliklar mavjud'}`, now]
      );
    } else {
      // Revoke / unverify
      await runQuery(
        `UPDATE users SET 
          verification_status = 'UNVERIFIED',
          verified_at = NULL,
          verification_rejection_reason = NULL,
          updated_at = ?
         WHERE id = ?`,
        [now, targetUserId]
      );
    }

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [targetUserId]);
    await persistDb();
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update or register passport details for user (Admin/IIV registry)
router.put('/users/:id/passport', async (req: AuthRequest, res) => {
  try {
    const targetUserId = req.params.id;
    const {
      passport_series,
      passport_number,
      pinfl,
      full_legal_name,
      birth_date,
      passport_issued_by,
      passport_issued_date,
    } = req.body;
    const now = new Date().toISOString();

    await runQuery(
      `UPDATE users SET 
        passport_series = ?,
        passport_number = ?,
        pinfl = ?,
        full_legal_name = ?,
        birth_date = ?,
        passport_issued_by = ?,
        passport_issued_date = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        passport_series ? passport_series.toUpperCase().trim() : null,
        passport_number ? passport_number.trim() : null,
        pinfl ? pinfl.trim() : null,
        full_legal_name ? full_legal_name.trim() : null,
        birth_date || null,
        passport_issued_by || null,
        passport_issued_date || null,
        now,
        targetUserId,
      ]
    );

    // Audit log
    const auditId = `aud_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, 'UPDATE_USER_PASSPORT', 'USER', ?, ?, ?)`,
      [auditId, req.user!.id, targetUserId, JSON.stringify({ pinfl, passport_series, passport_number }), now]
    );

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [targetUserId]);
    await persistDb();
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Organizations: Create organization by admin
router.post('/organizations', async (req: AuthRequest, res) => {
  try {
    const {
      name,
      owner_user_id,
      description,
      phone,
      website,
      address,
      region_id,
      district_id,
      logo_url,
      verification_status,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tashkilot nomi kiritilishi shart' });
    }

    const orgId = `org_${crypto.randomUUID().slice(0, 16)}`;
    const now = new Date().toISOString();
    const ownerId = owner_user_id || req.user!.id;

    await runQuery(
      `INSERT INTO organizations (
        id, name, logo_url, description, phone, website,
        region_id, district_id, address, owner_user_id,
        verification_status, verified_at, verified_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        name.trim(),
        logo_url || null,
        description || null,
        phone || null,
        website || null,
        region_id || null,
        district_id || null,
        address || null,
        ownerId,
        verification_status || 'UNVERIFIED',
        verification_status === 'VERIFIED' ? now : null,
        verification_status === 'VERIFIED' ? req.user!.id : null,
        now,
        now,
      ]
    );

    // Add owner membership
    const memberId = `mem_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'OWNER', ?)`,
      [memberId, orgId, ownerId, now]
    );

    const created = await queryOne('SELECT * FROM organizations WHERE id = ?', [orgId]);
    await persistDb();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Organizations: Edit organization
router.put('/organizations/:id', async (req: AuthRequest, res) => {
  try {
    const {
      name,
      description,
      phone,
      website,
      address,
      region_id,
      district_id,
      logo_url,
      verification_status,
    } = req.body;

    const orgId = req.params.id;
    const now = new Date().toISOString();

    await runQuery(
      `UPDATE organizations SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        phone = COALESCE(?, phone),
        website = COALESCE(?, website),
        address = COALESCE(?, address),
        region_id = COALESCE(?, region_id),
        district_id = COALESCE(?, district_id),
        logo_url = COALESCE(?, logo_url),
        verification_status = COALESCE(?, verification_status),
        updated_at = ?
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        description !== undefined ? description : null,
        phone !== undefined ? phone : null,
        website !== undefined ? website : null,
        address !== undefined ? address : null,
        region_id !== undefined ? region_id : null,
        district_id !== undefined ? district_id : null,
        logo_url !== undefined ? logo_url : null,
        verification_status !== undefined ? verification_status : null,
        now,
        orgId,
      ]
    );

    const updated = await queryOne('SELECT * FROM organizations WHERE id = ?', [orgId]);
    await persistDb();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Organizations: Delete organization
router.delete('/organizations/:id', async (req: AuthRequest, res) => {
  try {
    const orgId = req.params.id;
    await runQuery('DELETE FROM organizations WHERE id = ?', [orgId]);
    await persistDb();
    res.json({ success: true, message: 'Tashkilot muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Categories: Delete category
router.delete('/categories/:id', async (req: AuthRequest, res) => {
  try {
    const catId = req.params.id;
    await runQuery('DELETE FROM categories WHERE id = ?', [catId]);
    await persistDb();
    res.json({ success: true, message: 'Kategoriya muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Listings: Admin direct permanent deletion
router.delete('/listings/:id', async (req: AuthRequest, res) => {
  try {
    const listingId = req.params.id;
    const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [listingId]);
    if (!listing) {
      return res.status(404).json({ error: 'E’lon topilmadi' });
    }

    // Delete listing images
    await runQuery('DELETE FROM listing_images WHERE listing_id = ?', [listingId]);
    // Delete saved references
    await runQuery('DELETE FROM saved_listings WHERE listing_id = ?', [listingId]);
    // Delete listing
    await runQuery('DELETE FROM listings WHERE id = ?', [listingId]);

    // Audit log
    const auditId = `aud_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, 'ADMIN_DELETE_LISTING', 'LISTING', ?, ?, ?)`,
      [auditId, req.user!.id, listingId, JSON.stringify({ title: listing.title, owner: listing.owner_user_id }), new Date().toISOString()]
    );

    await persistDb();
    res.json({ success: true, message: 'E’lon tizimdan to‘liq va butunlay o‘chirib tashlandi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Platform Branding: GET
router.get('/branding', async (_req, res) => {
  try {
    const [setting, logoSetting] = await Promise.all([
      queryOne<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM system_settings WHERE key = ?',
        ['platform_brand']
      ),
      queryOne<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM system_settings WHERE key = ?',
        ['active_logo_url']
      ),
    ]);

    let brand = {
      prefix_text: 'top',
      prefix_color: '#111827',
      suffix_text: 'hand',
      suffix_color: '#1673E6',
      domain_suffix: '.uz',
      domain_color: '#1673E6',
      tagline: 'Mahalliy Xizmatlar va Ish Bozori Platformasi',
      logo_url: logoSetting?.value || '/TOPHAND.uz (1).png',
    };

    if (setting?.value) {
      try {
        brand = { ...brand, ...JSON.parse(setting.value) };
      } catch (e) {
        // fallback
      }
    }

    if (logoSetting?.value) {
      brand.logo_url = logoSetting.value;
    }

    res.json(brand);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Platform Branding: PUT
router.put('/branding', async (req: AuthRequest, res) => {
  try {
    const {
      prefix_text,
      prefix_color,
      suffix_text,
      suffix_color,
      domain_suffix,
      domain_color,
      tagline,
      logo_url,
    } = req.body;

    const existingLogoSetting = await queryOne<{ value: string }>(
      'SELECT value FROM system_settings WHERE key = ?',
      ['active_logo_url']
    );
    const existingBrandSetting = await queryOne<{ value: string }>(
      'SELECT value FROM system_settings WHERE key = ?',
      ['platform_brand']
    );
    let existingBrandLogo = '';
    if (existingBrandSetting?.value) {
      try {
        existingBrandLogo = JSON.parse(existingBrandSetting.value).logo_url;
      } catch (e) {}
    }

    const resolvedLogoUrl = logo_url || existingLogoSetting?.value || existingBrandLogo || '/TOPHAND.uz (1).png';

    const brandData = {
      prefix_text: prefix_text || 'top',
      prefix_color: prefix_color || '#111827',
      suffix_text: suffix_text || 'hand',
      suffix_color: suffix_color || '#1673E6',
      domain_suffix: domain_suffix || '.uz',
      domain_color: domain_color || '#1673E6',
      tagline: tagline || 'Mahalliy Xizmatlar va Ish Bozori Platformasi',
      logo_url: resolvedLogoUrl,
    };

    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('platform_brand', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [JSON.stringify(brandData), now, req.user!.id]
    );

    if (resolvedLogoUrl) {
      await runQuery(
        `INSERT INTO system_settings (key, value, updated_at, updated_by)
         VALUES ('active_logo_url', ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        [resolvedLogoUrl, now, req.user!.id]
      );
    }

    // Audit log
    const auditId = `aud_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, 'UPDATE_PLATFORM_BRANDING', 'SETTINGS', 'platform_brand', ?, ?)`,
      [auditId, req.user!.id, JSON.stringify(brandData), now]
    );

    await persistDb();
    res.json({ success: true, brand: brandData, message: 'Platforma nomi, ranglari va logotipi yangilandi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Faza 3: Monetization settings (admin controlled) ──────────────────
router.get('/monetization', async (_req, res) => {
  try {
    const cfg = await getMonetizationConfig();
    res.json(cfg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const MONETIZATION_NUMBER_KEYS = new Set([
  'listing_active_days_free', 'listing_active_days_paid', 'expiry_warning_days',
  'listing_price_services', 'listing_price_jobs', 'renew_price_services', 'renew_price_jobs',
  'promo_price_services', 'promo_price_jobs', 'promo_duration_hours',
]);
const MONETIZATION_BOOL_KEYS = new Set(['renew_enabled_paid', 'auto_approve_enabled']);

router.put('/monetization', async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const changes: Record<string, string> = {};

    // Mode
    if (body.monetization_mode !== undefined) {
      if (!['FREE_TEST', 'PAID'].includes(body.monetization_mode)) {
        return res.status(400).json({ error: 'Noto‘g‘ri monetizatsiya rejimi' });
      }
      changes.monetization_mode = body.monetization_mode;
    }
    // Free test end date
    if (body.free_test_end_date !== undefined) {
      const d = new Date(body.free_test_end_date);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Noto‘g‘ri sana' });
      changes.free_test_end_date = d.toISOString();
    }
    // Numeric keys
    for (const key of MONETIZATION_NUMBER_KEYS) {
      if (body[key] !== undefined) {
        const n = Number(body[key]);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: `${key}: manfiy bo‘lmagan son kerak` });
        }
        changes[key] = String(Math.round(n));
      }
    }
    // Boolean keys
    for (const key of MONETIZATION_BOOL_KEYS) {
      if (body[key] !== undefined) {
        changes[key] = body[key] === true || body[key] === '1' || body[key] === 1 ? '1' : '0';
      }
    }

    const keys = Object.keys(changes);
    if (keys.length === 0) return res.status(400).json({ error: 'O‘zgartirish kiritilmadi' });

    for (const key of keys) {
      await setSetting(key, changes[key], req.user!.id);
    }

    // Audit
    const auditId = `aud_${crypto.randomUUID().slice(0, 16)}`;
    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, 'UPDATE_MONETIZATION', 'SETTINGS', 'monetization', ?, ?)`,
      [auditId, req.user!.id, JSON.stringify(changes), now]
    );

    await persistDb();
    const cfg = await getMonetizationConfig();
    res.json({ success: true, config: cfg, message: 'Monetizatsiya sozlamalari saqlandi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Faza 12: Excel import / export ──────────────────────────────────────
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx') {
      return cb(new Error('Faqat .xlsx formatidagi fayllar qabul qilinadi.'));
    }
    cb(null, true);
  },
});

// GET /api/admin/export/:entity — download a table as .xlsx
router.get('/export/:entity', async (req, res: Response) => {
  try {
    const entity = req.params.entity;
    if (!isSupportedEntity(entity)) {
      return res.status(400).json({ error: `Noma'lum entitet: ${entity}` });
    }
    const buffer = await exportToXlsx(entity);
    const auditId = `aud_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, 'EXPORT_EXCEL', 'ENTITY', ?, ?, ?)`,
      [auditId, (req as AuthRequest).user!.id, entity, JSON.stringify({ entity }), new Date().toISOString()]
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="tophand-${entity}-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/import/:entity — upload .xlsx and upsert rows
router.post('/import/:entity', excelUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const entity = req.params.entity!;
    if (!isSupportedEntity(entity)) {
      return res.status(400).json({ error: `Noma'lum entitet: ${entity}` });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Fayl yuklanmadi (field: file)' });
    }
    const report = await importFromXlsx(entity, req.file.buffer);
    const auditId = `aud_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
       VALUES (?, ?, 'IMPORT_EXCEL', 'ENTITY', ?, ?, ?)`,
      [auditId, req.user!.id, entity, JSON.stringify(report), new Date().toISOString()]
    );
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
