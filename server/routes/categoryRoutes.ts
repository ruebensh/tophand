import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import { AuthRequest, requireAuth, requireRole } from '../auth/telegram.ts';

const router = Router();

// GET /api/categories - Kategoriyalar ro'yxati (ixtiyoriy ?catalog_id=services&parent_id=...&scope=...)
router.get('/', async (req, res) => {
  try {
    const { catalog_id, parent_id, only_parents, scope } = req.query;

    let sql = `
      WITH RECURSIVE reach(root, id) AS (
        SELECT id, id FROM categories
        UNION ALL
        SELECT r.root, c2.id FROM categories c2 JOIN reach r ON c2.parent_id = r.id
      ),
      counts AS (
        SELECT r.root AS category_id, COUNT(l.id) AS active_count
        FROM reach r
        LEFT JOIN listings l ON l.category_id = r.id AND l.status = 'ACTIVE'
        GROUP BY r.root
      )
      SELECT c.*, COALESCE(cnt.active_count, 0) AS active_count
      FROM categories c
      LEFT JOIN counts cnt ON cnt.category_id = c.id
      WHERE c.is_active = 1
    `;
    const params: any[] = [];

    if (catalog_id) {
      sql += ` AND c.catalog_id = ?`;
      params.push(catalog_id);
    }

    // Jobs catalog carries two trees distinguished by `scope`.
    if (scope) {
      sql += ` AND c.scope = ?`;
      params.push(scope);
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
    serverError(res, err);
  }
});

// GET /api/categories/tree - Kategoriyalar va ularning subkategoriyalari daraxti
router.get('/tree', async (req, res) => {
  try {
    const { catalog_id, scope } = req.query;

    let sql = `
      WITH RECURSIVE reach(root, id) AS (
        SELECT id, id FROM categories
        UNION ALL
        SELECT r.root, c2.id FROM categories c2 JOIN reach r ON c2.parent_id = r.id
      ),
      counts AS (
        SELECT r.root AS category_id, COUNT(l.id) AS active_count
        FROM reach r
        LEFT JOIN listings l ON l.category_id = r.id AND l.status = 'ACTIVE'
        GROUP BY r.root
      )
      SELECT c.*, COALESCE(cnt.active_count, 0) AS active_count
      FROM categories c
      LEFT JOIN counts cnt ON cnt.category_id = c.id
      WHERE c.is_active = 1
    `;
    const params: any[] = [];

    if (catalog_id) {
      sql += ` AND c.catalog_id = ?`;
      params.push(catalog_id);
    }

    if (scope) {
      sql += ` AND c.scope = ?`;
      params.push(scope);
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
    serverError(res, err);
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
      `WITH RECURSIVE reach(root, id) AS (
         SELECT id, id FROM categories
         UNION ALL
         SELECT r.root, c2.id FROM categories c2 JOIN reach r ON c2.parent_id = r.id
       ),
       counts AS (
         SELECT r.root AS category_id, COUNT(l.id) AS active_count
         FROM reach r
         LEFT JOIN listings l ON l.category_id = r.id AND l.status = 'ACTIVE'
         GROUP BY r.root
       )
       SELECT c.*, COALESCE(cnt.active_count, 0) AS active_count
       FROM categories c
       LEFT JOIN counts cnt ON cnt.category_id = c.id
       WHERE c.parent_id = ? AND c.is_active = 1
       ORDER BY c.sort_order ASC, c.name_uz ASC`,
      [category.id]
    );

    res.json({
      ...category,
      subs,
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

// GET /api/categories/:id/attributes - Kategoriyaga mos atribut sxemasi
router.get('/:id/attributes', async (req, res) => {
  try {
    const category = await queryOne(
      'SELECT id FROM categories WHERE id = ? OR slug = ?',
      [req.params.id, req.params.id]
    );
    if (!category) {
      return res.status(404).json({ error: 'Kategoriya topilmadi' });
    }

    const attrs = await queryAll(
      `SELECT id, category_id, key, label_uz as label, type, options, unit, required, filterable, sort_order,
              is_popular, popular_order, popular_values, section, meta
       FROM category_attributes
       WHERE category_id = ?
       ORDER BY sort_order ASC`,
      [category.id]
    );
    const toJsonArray = (v: any): any[] =>
      Array.isArray(v) ? v : (v ? JSON.parse(v) : []);
    const toObj = (v: any): Record<string, any> =>
      (v && typeof v === 'object' && !Array.isArray(v)) ? v : (v ? JSON.parse(v) : {});
    // options/popular_values/meta JSONB -> ensure array/object; integer flags -> boolean
    const parsed = attrs.map((a: any) => ({
      ...a,
      options: toJsonArray(a.options),
      popular_values: toJsonArray(a.popular_values),
      meta: toObj(a.meta),
      section: a.section || 'Asosiy',
      required: Number(a.required) === 1,
      filterable: Number(a.filterable) === 1,
      is_popular: Number(a.is_popular) === 1,
      popular_order: Number(a.popular_order) || 0,
    }));
    res.json(parsed);
  } catch (err: any) {
    serverError(res, err);
  }
});

// GET /api/categories/:id/popular - Kategoriyaga mos "top mashxur" qatori:
// gibrid = curate tartiblangan qiymatlar + kategoriya daraxtidagi jonli e'lon sonlari.
// Mashxur atribut sozlanmagan bo'lsa -> items: [] (klientda reklama sloti chiqadi).
router.get('/:id/popular', async (req, res) => {
  try {
    const category = await queryOne(
      'SELECT id FROM categories WHERE id = ? OR slug = ?',
      [req.params.id, req.params.id]
    );
    if (!category) {
      return res.status(404).json({ error: 'Kategoriya topilmadi' });
    }

    // Bu kategoriya uchun belgilangan mashxur atribut (is_popular=1).
    const popularAttr = await queryOne<any>(
      `SELECT key, label_uz, popular_values
       FROM category_attributes
       WHERE category_id = ? AND is_popular = 1
       ORDER BY popular_order ASC, sort_order ASC
       LIMIT 1`,
      [category.id]
    );
    if (!popularAttr) {
      return res.json({ key: null, label: '', items: [] });
    }

    const curated: string[] = Array.isArray(popularAttr.popular_values)
      ? popularAttr.popular_values
      : (popularAttr.popular_values ? JSON.parse(popularAttr.popular_values) : []);

    // Kalitni faqat [a-zA-Z0-9_] belgilariga cheklab, SQL injection'ni oldini olamiz
    // (operator argumenti parametr bo'la olmaydi, shuning uchun literal sifatida inline).
    const safeKey = String(popularAttr.key).replace(/[^a-zA-Z0-9_]/g, '');

    // Kategoriya daraxti (ota + barcha avlodlar) bo'yicha jonli sonlar.
    // DIQQAT: `?` jsonb-existence operatorini ishlatmaymiz — placeholder tarjimoni
    // chalg'itadi. `attributes->>'key' IS NOT NULL` yetarli (kalitsiz qatorlar NULL).
    const counts = await queryAll<{ value: string; cnt: number }>(
      `WITH RECURSIVE reach(id) AS (
         SELECT ?::text
         UNION ALL
         SELECT c.id FROM categories c JOIN reach r ON c.parent_id = r.id
       )
       SELECT l.attributes->>'${safeKey}' AS value, COUNT(*)::int AS cnt
       FROM listings l
       JOIN reach r ON l.category_id = r.id
       WHERE l.status = 'ACTIVE' AND l.attributes->>'${safeKey}' IS NOT NULL
       GROUP BY 1`,
      [category.id]
    );
    const countMap = new Map<string, number>();
    for (const row of counts) {
      if (row.value != null) countMap.set(String(row.value), Number(row.cnt) || 0);
    }

    let items: { value: string; count: number }[];
    if (curated.length > 0) {
      // Gibrid: avval curate tartibi (jonli son bilan), so'ng qolgan JONLI
      // qiymatlar son bo'yicha qo'shiladi — ya'ni ro'yxat avtomatik to'ldiriladi,
      // curate bilan cheklanmaydi ("soni o'zgarmasins" = fiksatsiya qilinmasin).
      const seen = new Set<string>();
      items = [];
      for (const value of curated) {
        if (seen.has(value)) continue;
        seen.add(value);
        items.push({ value, count: countMap.get(value) || 0 });
      }
      Array.from(countMap.entries())
        .filter(([v]) => !seen.has(v))
        .sort((a, b) => b[1] - a[1])
        .forEach(([value, count]) => items.push({ value, count }));
    } else {
      // Curate ro'yxat bo'lmasa — butunlay jonli aniqlangan qiymatlar.
      items = Array.from(countMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }));
    }
    // Ko'proq ko'rsatiladi (2 qator uchun) — checksiz emas, lekin katta limit.
    items = items.slice(0, 80);

    res.json({ key: popularAttr.key, label: popularAttr.label_uz, items });
  } catch (err: any) {
    serverError(res, err);
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
    serverError(res, err);
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
    serverError(res, err);
  }
});

// ADMIN: DELETE /api/categories/:id - Kategoriyani o'chirish
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req: AuthRequest, res) => {
  try {
    const catId = req.params.id;

    // Check listings count across the whole category subtree (recursive, any depth)
    const hasListings = await queryOne(
      `WITH RECURSIVE reach(root, id) AS (
         SELECT ?::text, ?::text
         UNION ALL
         SELECT r.root, c.id FROM categories c JOIN reach r ON c.parent_id = r.id
       )
       SELECT COUNT(*) as cnt FROM listings WHERE category_id IN (SELECT id FROM reach)`,
      [catId, catId]
    );
    const listingCount = parseInt(hasListings?.cnt || '0', 10);

    if (listingCount > 0) {
      // Soft-delete to preserve listing integrity (deactivate the entire subtree)
      await runQuery(
        `WITH RECURSIVE reach(root, id) AS (
           SELECT ?::text, ?::text
           UNION ALL
           SELECT r.root, c.id FROM categories c JOIN reach r ON c.parent_id = r.id
         )
         UPDATE categories SET is_active = 0, updated_at = ? WHERE id IN (SELECT id FROM reach)`,
        [catId, catId, new Date().toISOString()]
      );
      return res.json({ success: true, message: `Kategoriya va uning subkategoriyalari nofaol holatga o‘tkazildi (${listingCount} ta e’lon mavjud)` });
    }

    // Hard delete
    await runQuery('DELETE FROM categories WHERE parent_id = ?', [catId]);
    await runQuery('DELETE FROM categories WHERE id = ?', [catId]);

    res.json({ success: true, message: 'Kategoriya va uning subkategoriyalari muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
