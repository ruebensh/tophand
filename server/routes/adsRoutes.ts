import { Router, Response } from 'express';
import { getActiveAds, incrementImpression, incrementClick, type Ad } from '../services/adService.ts';

const router = Router();

// GET /api/ads/active — frontend uchun aktiv kampaniyalar, joylashuv bo'yicha guruhlangan.
router.get('/active', async (_req, res: Response) => {
  try {
    const ads = await getActiveAds();
    const buckets: Record<'top' | 'popular' | 'inline' | 'sidebar', Ad[]> = {
      top: [], popular: [], inline: [], sidebar: [],
    };
    for (const ad of ads) {
      if (ad.placement === 'all') {
        buckets.top.push(ad);
        buckets.popular.push(ad);
        buckets.inline.push(ad);
        buckets.sidebar.push(ad);
      } else if (buckets[ad.placement as keyof typeof buckets]) {
        buckets[ad.placement as keyof typeof buckets].push(ad);
      }
    }
    res.json(buckets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ads/track — { id, event: 'impression' | 'click' }. Beholta hisoblagich.
router.post('/track', async (req, res: Response) => {
  try {
    const { id, event } = req.body || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id kerak' });
    if (event === 'impression') await incrementImpression(id);
    else if (event === 'click') await incrementClick(id);
    else return res.status(400).json({ error: "event 'impression' yoki 'click' bo'lishi kerak" });
    res.status(204).end();
  } catch {
    // Hisoblagich xatosi foydalanuvchiga ta'sir qilmasligi kerak.
    res.status(204).end();
  }
});

export default router;
