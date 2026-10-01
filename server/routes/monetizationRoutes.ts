import { Router, Response } from 'express';
import { getPublicMonetization } from '../services/monetizationService.ts';

const router = Router();

// GET /api/monetization/public — single source of truth for the frontend
router.get('/public', async (_req, res: Response) => {
  try {
    const data = await getPublicMonetization();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
