import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import { AuthRequest, requireAuth, requireRole } from '../auth/telegram.ts';

const router = Router();

// GET /api/catalogs - Barcha faol kataloglar
router.get('/', async (_req, res) => {
  try {
    const catalogs = await queryAll(`
      SELECT c.*,
        (SELECT COUNT(*) FROM categories cat WHERE cat.catalog_id = c.id AND cat.parent_id IS NULL AND cat.is_active = 1) AS categories_count,
        (SELECT COUNT(*) FROM listings l WHERE (l.catalog_id = c.id OR (l.catalog_id IS NULL AND l.type IN (SELECT unnest(string_to_array(c.listing_types, ','))))) AND l.status = 'ACTIVE') AS listings_count,
        (
          SELECT li.url FROM listings l
          JOIN listing_images li ON li.listing_id = l.id AND li.media_type = 'image'
          WHERE (l.catalog_id = c.id OR (l.catalog_id IS NULL AND l.type IN (SELECT unnest(string_to_array(c.listing_types, ',')))))
            AND l.status = 'ACTIVE'
          ORDER BY l.created_at DESC, li.sort_order ASC
          LIMIT 1
        ) AS cover_image
      FROM catalogs c
      WHERE c.is_active = 1
      ORDER BY c.sort_order ASC, c.created_at ASC
    `);

    res.json(catalogs);
  } catch (err: any) {
    serverError(res, err);
  }
});

// GET /api/catalogs/:id - Bitta katalog ma'lumotlari
router.get('/:id', async (req, res) => {
  try {
    const catalog = await queryOne(
      'SELECT * FROM catalogs WHERE id = ? OR slug = ?',
      [req.params.id, req.params.id]
    );
    if (!catalog) {
      return res.status(404).json({ error: 'Katalog topilmadi' });
    }
    res.json(catalog);
  } catch (err: any) {
    serverError(res, err);
  }
});

// ADMIN: POST /api/catalogs - Yangi katalog qo'shish
router.post('/', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { name_uz, slug, icon, description, listing_types, sort_order } = req.body;
    if (!name_uz || !slug) {
      return res.status(400).json({ error: 'Nomi va slug kiritilishi shart' });
    }

    const id = `catlg_${slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const now = new Date().toISOString();

    await runQuery(`
      INSERT INTO catalogs (id, name_uz, slug, icon, description, listing_types, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      id,
      name_uz.trim(),
      slug.trim(),
      icon || 'Briefcase',
      description || null,
      listing_types || 'SERVICE_OFFER,SERVICE_REQUEST',
      sort_order || 0,
      now,
      now
    ]);

    const created = await queryOne('SELECT * FROM catalogs WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    serverError(res, err);
  }
});

// ADMIN: PUT /api/catalogs/:id - Katalogni tahrirlash
router.put('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { name_uz, icon, description, listing_types, sort_order, is_active } = req.body;
    const now = new Date().toISOString();

    await runQuery(`
      UPDATE catalogs
      SET name_uz = COALESCE(?, name_uz),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description),
          listing_types = COALESCE(?, listing_types),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          updated_at = ?
      WHERE id = ?
    `, [
      name_uz || null,
      icon || null,
      description !== undefined ? description : null,
      listing_types || null,
      sort_order !== undefined ? sort_order : null,
      is_active !== undefined ? is_active : null,
      now,
      req.params.id
    ]);

    const updated = await queryOne('SELECT * FROM catalogs WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    serverError(res, err);
  }
});

// ADMIN: DELETE /api/catalogs/:id - Katalogni o'chirish (yoki soft delete)
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const catalogId = req.params.id;
    // Check if category or listing belongs to this catalog
    const hasCategories = await queryOne('SELECT COUNT(*) as cnt FROM categories WHERE catalog_id = ?', [catalogId]);
    const catCount = parseInt(hasCategories?.cnt || '0', 10);
    if (catCount > 0) {
      // Soft-delete instead of hard delete to keep data safe
      await runQuery('UPDATE catalogs SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), catalogId]);
      return res.json({ success: true, message: 'Katalog nofaol holatga o‘tkazildi (ichida kategoriyalar mavjudligi sababli)' });
    }

    await runQuery('DELETE FROM catalogs WHERE id = ?', [catalogId]);
    res.json({ success: true, message: 'Katalog butunlay o‘chirildi' });
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
