import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/telegram.ts';
import { getBalance, topUp, listTransactions } from '../services/walletService.ts';

const router = Router();

// GET /api/wallet — current balance + recent transactions
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const balance = await getBalance(req.user!.id);
    const transactions = await listTransactions(req.user!.id, 30);
    res.json({ balance, currency: 'UZS', transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wallet/transactions
router.get('/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const transactions = await listTransactions(req.user!.id, limit);
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wallet/topup — add funds (stub: real payment gateway integrated later).
router.post('/topup', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
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
