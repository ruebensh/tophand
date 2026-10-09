import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../auth/telegram.ts';
import { queryAll, queryOne, runQuery } from '../db/database.ts';

const router = Router();

// Get notifications and unread count
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifications = await queryAll(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id]
    );

    const unreadCountRes = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      [req.user!.id]
    );

    res.json({
      notifications,
      unread_count: unreadCountRes?.count || 0,
    });
  } catch (err: any) {
    serverError(res, err);
  }
});

// Mark all as read
router.post('/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();
    await runQuery(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, [
      now,
      req.user!.id,
    ]);
    res.json({ success: true });
  } catch (err: any) {
    serverError(res, err);
  }
});

// Mark single as read
router.post('/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();
    await runQuery(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`, [
      now,
      req.params.id,
      req.user!.id,
    ]);
    res.json({ success: true });
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
