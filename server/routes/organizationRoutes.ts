import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, optionalAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, queryAll, runQuery } from '../db/database.ts';
import { sanitizeUserUrl, sanitizeUserUrlLoose } from '../lib/urlSecurity.ts';

const router = Router();

// Get organization by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const org = await queryOne<any>(
      `SELECT 
        o.*,
        u.name as owner_name,
        r.name_uz as region_name,
        d.name_uz as district_name
       FROM organizations o
       JOIN users u ON o.owner_user_id = u.id
       LEFT JOIN regions r ON o.region_id = r.id
       LEFT JOIN districts d ON o.district_id = d.id
       WHERE o.id = ?`,
      [req.params.id]
    );

    if (!org) {
      return res.status(404).json({ error: 'Tashkilot topilmadi' });
    }

    // Active vacancies / listings
    const listings = await queryAll<any>(
      `SELECT 
        l.*,
        c.name_uz as category_name,
        r.name_uz as region_name,
        d.name_uz as district_name,
        (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order ASC LIMIT 1) as cover_image
       FROM listings l
       JOIN categories c ON l.category_id = c.id
       JOIN regions r ON l.region_id = r.id
       JOIN districts d ON l.district_id = d.id
       WHERE l.organization_id = ? AND l.status = 'ACTIVE'
       ORDER BY l.created_at DESC`,
      [org.id]
    );
    org.listings = listings;

    // Check if current user is member
    org.user_membership_role = null;
    if (req.user) {
      const membership = await queryOne<any>(
        'SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?',
        [org.id, req.user.id]
      );
      if (membership) {
        org.user_membership_role = membership.role;
      }
    }

    res.json(org);
  } catch (err: any) {
    serverError(res, err);
  }
});

// Create organization (Section 4 & 5)
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, logo_url, description, phone, website, region_id, district_id, address } = req.body;
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ error: 'Tashkilot nomi kamida 3 ta belgidan iborat bo‘lishi kerak' });
    }

    const id = `org_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO organizations (
        id, name, logo_url, description, phone, website, region_id, district_id, address,
        owner_user_id, verification_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNVERIFIED', ?, ?)`,
      [
        id,
        name.trim(),
        sanitizeUserUrl(logo_url) || null,
        description ? description.trim() : null,
        phone || null,
        sanitizeUserUrlLoose(website) || null,
        region_id || null,
        district_id || null,
        address || null,
        req.user!.id,
        now,
        now,
      ]
    );

    // Add owner as OrganizationMember with role OWNER
    await runQuery(
      `INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'OWNER', ?)`,
      [`mem_${crypto.randomUUID().slice(0, 16)}`, id, req.user!.id, now]
    );

    const created = await queryOne('SELECT * FROM organizations WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    serverError(res, err);
  }
});

// Get user's organizations
router.get('/my/list', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orgs = await queryAll(
      `SELECT o.*, m.role as member_role 
       FROM organizations o
       JOIN organization_members m ON o.id = m.organization_id
       WHERE m.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user!.id]
    );
    res.json(orgs);
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
