import { Router } from 'express';
import { queryAll } from '../db/database.ts';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const categories = await queryAll(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM listings WHERE category_id = c.id AND status = 'ACTIVE') as active_count
       FROM categories c 
       WHERE c.is_active = 1 
       ORDER BY c.sort_order ASC`
    );
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
