import { Router } from 'express';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import { AuthRequest, requireAuth, requireRole } from '../auth/telegram.ts';

const router = Router();

// GET /api/categories - Kategoriyalar ro'yxati (ixtiyoriy ?catalog_id=services&parent_id=...)
router.get('/', async (req, res) => {
  try {
    const { catalog_id, parent_id, only_parents } = req.query;

    let sql = `
      SELECT c.*, 
        (
          SELECT COUNT(*) 
          FROM listings l 
          WHERE (l.category_id = c.id OR l.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))
            AND l.status = 'ACTIVE'
        ) as active_count
      FROM categories c 
      WHERE c.is_active = 1
    `;
    const params: any[] = [];

    if (catalog_id) {
      sql += ` AND c.catalog_id = ?`;
      params.push(catalog_id);
    }

    if (only_parents === 'true' || only_parents === '1') {
      sql += ` AND c.parent_id IS NULL`;
    } else if (parent_id !== undefined) {
      if (parent_id === 'null' || parent_id === '') {
        sql += ` AND c.parent_id IS NULL`;
      } else {
        sql += ` AND c.parent_id = ?`;
        params.push(parent_id);
      }
    }

    sql += ` ORDER BY c.parent_id IS NOT NULL, c.sort_order ASC, c.name_uz ASC`;

    const categories = await queryAll(sql, params);
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories/tree - Kategoriyalar va ularning subkategoriyalari daraxti
router.get('/tree', async (req, res) => {
  try {
    const { catalog_id } = req.query;

    let sql = `
      SELECT c.*, 
        (
          SELECT COUNT(*) 
          FROM listings l 
          WHERE (l.category_id = c.id OR l.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))
            AND l.status = 'ACTIVE'
        ) as active_count
      FROM categories c 
      WHERE c.is_active = 1
    `;
    const params: any[] = [];

    if (catalog_id) {
      sql += ` AND c.catalog_id = ?`;
      params.push(catalog_id);
    }

    sql += ` ORDER BY c.sort_order ASC, c.name_uz ASC`;

    const allCategories = await queryAll(sql, params);

    // Ota va bolalarni ajratib tree tuzamiz
    const parents = allCategories.filter((c: any) => !c.parent_id);
    const children = allCategories.filter((c: any) => Boolean(c.parent_id));

    const tree = parents.map((parent: any) => {
      const subs = children.filter((child: any) => child.parent_id === parent.id);
      return {
        ...parent,
        subs,
      };
    });

    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories/:id - Bitta kategoriya va uning subkategoriyalari
router.get('/:id', async (req, res) => {
  try {
    const category = await queryOne(
      'SELECT * FROM categories WHERE id = ? OR slug = ?',
      [req.params.id, req.params.id]
    );

    if (!category) {
      return res.status(404).json({ error: 'Kategoriya topilmadi' });
    }

    const subs = await queryAll(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM listings WHERE category_id = c.id AND status = 'ACTIVE') as active_count
       FROM categories c
       WHERE c.parent_id = ? AND c.is_active = 1
       ORDER BY c.sort_order ASC, c.name_uz ASC`,
      [category.id]
    );

    res.json({
      ...category,
      subs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: POST /api/categories - Yangi kategoriya yoki subkategoriya qo'shish
router.post('/', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { name_uz, slug, icon, catalog_id, parent_id, sort_order } = req.body;
    if (!name_uz || !slug) {
      return res.status(400).json({ error: 'Kategoriya nomi va slug kiritilishi shart' });
    }

    const id = `cat_${slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const now = new Date().toISOString();

    await runQuery(`
      INSERT INTO categories (id, catalog_id, name_uz, slug, icon, parent_id, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `, [
      id,
      catalog_id || 'services',
      name_uz.trim(),
      slug.trim(),
      icon || 'Layers',
      parent_id || null,
      sort_order || 0,
      now,
      now
    ]);

    const created = await queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: PUT /api/categories/:id - Kategoriyani tahrirlash
router.put('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { name_uz, slug, icon, catalog_id, parent_id, sort_order, is_active } = req.body;
    const now = new Date().toISOString();

    await runQuery(`
      UPDATE categories
      SET name_uz = COALESCE(?, name_uz),
          slug = COALESCE(?, slug),
          icon = COALESCE(?, icon),
          catalog_id = COALESCE(?, catalog_id),
          parent_id = COALESCE(?, parent_id),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active),
          updated_at = ?
      WHERE id = ?
    `, [
      name_uz || null,
      slug || null,
      icon || null,
      catalog_id || null,
      parent_id !== undefined ? parent_id : null,
      sort_order !== undefined ? sort_order : null,
      is_active !== undefined ? is_active : null,
      now,
      req.params.id
    ]);

    const updated = await queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: DELETE /api/categories/:id - Kategoriyani o'chirish
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const catId = req.params.id;

    // Check listings count
    const hasListings = await queryOne(
      'SELECT COUNT(*) as cnt FROM listings WHERE category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?)',
      [catId, catId]
    );
    const listingCount = parseInt(hasListings?.cnt || '0', 10);

    if (listingCount > 0) {
      // Soft-delete to preserve listing integrity
      await runQuery('UPDATE categories SET is_active = 0, updated_at = ? WHERE id = ? OR parent_id = ?', [new Date().toISOString(), catId, catId]);
      return res.json({ success: true, message: `Kategoriya va uning subkategoriyalari nofaol holatga o‘tkazildi (${listingCount} ta e’lon mavjud)` });
    }

    // Hard delete
    await runQuery('DELETE FROM categories WHERE parent_id = ?', [catId]);
    await runQuery('DELETE FROM categories WHERE id = ?', [catId]);

    res.json({ success: true, message: 'Kategoriya va uning subkategoriyalari muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
