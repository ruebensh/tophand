import { serverError } from '../lib/error.ts';
import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/telegram.ts';
import { getBalance, topUp, listTransactions } from '../services/walletService.ts';
import { INSECURE_ALLOWED } from '../lib/envSecurity.ts';

const router = Router();

// GET /api/wallet — current balance + recent transactions
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const balance = await getBalance(req.user!.id);
    const transactions = await listTransactions(req.user!.id, 30);
    res.json({ balance, currency: 'UZS', transactions });
  } catch (err: any) {
    serverError(res, err);
  }
});

// GET /api/wallet/transactions
router.get('/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const transactions = await listTransactions(req.user!.id, limit);
    res.json({ transactions });
  } catch (err: any) {
    serverError(res, err);
  }
});

// POST /api/wallet/topup — add funds.
// SECURITY (H-05 / P1-3): this is a demo stub that mints balance with NO verified
// payment. It must never be reachable in an internet-exposed env. It is enabled
// ONLY under an explicit LOCAL_DEV=1. The ALLOW_DEMO_TOPUP=1 override is NOT
// honored when exposed (staging/preview/unset/production) — a stray env var on a
// public host can no longer re-open free balance. Real path = verified payment-
// provider webhook calling topUp() with exact amount/currency, ownership,
// idempotency and provider transaction id.
router.post('/topup', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const demoAllowed = INSECURE_ALLOWED;
    if (!demoAllowed) {
      return res.status(503).json({
        error: "To'lov tizimi ulanmagan — balans to'ldirish vaqtincha o'chirilgan.",
      });
    }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 100) {
      return res.status(400).json({ error: 'Summa kamida 100 so‘m bo‘lishi kerak' });
    }
    if (amount > 100_000_000) {
      return res.status(400).json({ error: 'Summa juda katta' });
    }
    const balance = await topUp(req.user!.id, Math.round(amount), {
      ref_type: 'TOPUP',
      note: req.body?.method ? `To'ldirish: ${req.body.method}` : 'Balans to‘ldirish',
    });
    res.json({ success: true, balance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
