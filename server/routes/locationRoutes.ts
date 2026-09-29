import { Router } from 'express';
import { queryAll } from '../db/database.ts';

const router = Router();

router.get('/regions', async (_req, res) => {
  try {
    const regions = await queryAll('SELECT * FROM regions ORDER BY sort_order ASC');
    res.json(regions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/districts', async (req, res) => {
  try {
    const regionId = req.query.region_id as string;
    let sql = 'SELECT * FROM districts';
    const params: any[] = [];
    if (regionId) {
      sql += ' WHERE region_id = ?';
      params.push(regionId);
    }
    sql += ' ORDER BY sort_order ASC';

    const districts = await queryAll(sql, params);
    res.json(districts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
