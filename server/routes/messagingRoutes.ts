import { Router, Response, NextFunction } from 'express';
import { requireAuth, requireMinLevel, AuthRequest } from '../auth/telegram.ts';
import { sendStaffMessage, getMessagingHistory, canUserMessage, listSelectableUsers } from '../services/messagingService.ts';
import { listCannedResponses } from '../services/moderationAssignService.ts';

const router = Router();

/** Gate: only staff granted messaging access may send on behalf of TopHand. */
async function requireMessaging(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    const allowed = await canUserMessage(req.user.role, req.user.id);
    if (!allowed) {
      return res.status(403).json({ error: 'Xabar yuborish uchun ruxsat berilmagan' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Send a staff message (single / selected / all), BROADCAST or PER_USER
router.post('/send', requireAuth, requireMessaging, async (req: AuthRequest, res) => {
  try {
    const { recipients, mode, subject, body, link } = req.body;
    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: "Xabar matni bo'sh bo'lmasligi kerak" });
    }
    if (!recipients || (!recipients.all && !Array.isArray(recipients.user_ids) && !recipients.filter)) {
      return res.status(400).json({ error: 'Qabul qiluvchilarni belgilang (all / user_ids / filter)' });
    }
    const result = await sendStaffMessage({
      senderId: req.user!.id,
      senderRole: req.user!.role,
      recipients,
      mode: mode === 'PER_USER' ? 'PER_USER' : 'BROADCAST',
      subject,
      body,
      link,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Templates (canned responses) available for quick insert
router.get('/templates', requireAuth, requireMinLevel('INTERN_MOD'), async (_req, res) => {
  try {
    res.json(await listCannedResponses());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Searchable, PII-safe user directory for picking message recipients (staff only)
router.get('/users', requireAuth, requireMessaging, async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string | undefined;
    res.json(await listSelectableUsers(search));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// History of sent staff messages (own for moderators, all for admin+)
router.get('/history', requireAuth, requireMinLevel('INTERN_MOD'), async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
    res.json(await getMessagingHistory(isAdmin ? undefined : req.user!.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
