import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { queryAll } from '../db/database.ts';

const router = Router();

// GET /api/skills?q=&limit= — ish e'loni ko'nikmalari (skills) autosuggest.
//   - `q` bo'sh → eng ko'p ishlatilgan (top) teglar.
//   - `q` bor   → norm bo'yicha prefix + contains qidiruv (ILIKE, parameterized).
// Javob: [{ name, category_hint }] — tartiblangan, `limit` gacha (default 10, max 15).
router.get('/', async (req, res) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q : '';
    const q = qRaw.trim().toLowerCase();

    let limit = parseInt(String(req.query.limit ?? ''), 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 10;
    if (limit > 15) limit = 15;

    if (!q) {
      const rows = await queryAll(
        `SELECT name, category_hint FROM job_skills
         ORDER BY usage_count DESC, name ASC LIMIT ?`,
        [limit]
      );
      return res.json(rows);
    }

    // Prefix mosliklari yuqoriroq reyting oladi (boshlanish → 0, ichida → 1).
    const rows = await queryAll(
      `SELECT name, category_hint,
         CASE WHEN norm LIKE ? THEN 0 ELSE 1 END AS rank
       FROM job_skills
       WHERE norm LIKE ? OR norm LIKE ?
       ORDER BY rank ASC, usage_count DESC, name ASC
       LIMIT ?`,
      [`${q}%`, `${q}%`, `%${q}%`, limit]
    );
    res.json(rows.map((r: any) => ({ name: r.name, category_hint: r.category_hint })));
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
