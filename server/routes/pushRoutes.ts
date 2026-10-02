import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/telegram.ts';
import {
  getPublicKey,
  isPushConfigured,
  saveSubscription,
  deleteSubscription,
  hasSubscription,
} from '../services/pushService.ts';

const router = Router();

// Public VAPID key + whether push is enabled on the server. No auth needed —
// the frontend needs it before it can subscribe.
router.get('/public-key', (_req, res: Response) => {
  res.json({ key: getPublicKey(), enabled: isPushConfigured() });
});

// Current user's push subscription status.
router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const subscribed = await hasSubscription(req.user!.id);
    res.json({ subscribed, enabled: isPushConfigured() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save / refresh a subscription for the logged-in user.
router.post('/subscribe', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const endpoint = req.body?.endpoint;
    const keys = req.body?.keys;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Yaroqsiz push obunasi' });
    }
    await saveSubscription(req.user!.id, endpoint, keys.p256dh, keys.auth);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Remove a subscription (on "disable" or logout).
router.post('/unsubscribe', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint ko‘rsatilmadi' });
    await deleteSubscription(endpoint);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
