import { serverError } from '../lib/error.ts';
import { Router, Response } from 'express';
import { getPublicMonetization } from '../services/monetizationService.ts';

const router = Router();

// GET /api/monetization/public — single source of truth for the frontend
router.get('/public', async (_req, res: Response) => {
  try {
    const data = await getPublicMonetization();
    res.json(data);
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
