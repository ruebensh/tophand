import { Router } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../auth/telegram.ts';
import { createReport, getReports, takeModeratorAction } from '../services/moderationService.ts';
import {
  getAutoFlaggedContent,
  resolveAutoFlagged,
  getProfanityWords,
  addProfanityWord,
  deleteProfanityWord,
} from '../services/autoModerationService.ts';

const router = Router();

// File a report (Any authenticated user)
router.post('/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { target_type, target_id, reason, description } = req.body;
    if (!target_type || !target_id || !reason) {
      return res.status(400).json({ error: 'Barcha majburiy maydonlar to‘ldirilishi shart' });
    }

    const report = await createReport(req.user!.id, {
      target_type,
      target_id,
      reason,
      description,
    });

    res.status(201).json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// View reports list (Moderator and Admin only)
router.get('/reports', requireAuth, requireRole(['MODERATOR', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string;
    const reports = await getReports(status);
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Moderator take action (Section 33)
router.post('/action', requireAuth, requireRole(['MODERATOR', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { report_id, action, target_type, target_id, reason, ban_days } = req.body;
    if (!action || !target_type || !target_id || !reason) {
      return res.status(400).json({ error: 'Amal, obyekt va sabab ko‘rsatilishi shart' });
    }

    const result = await takeModeratorAction(req.user!.id, {
      report_id,
      action,
      target_type,
      target_id,
      reason,
      ban_days: ban_days ? parseInt(ban_days, 10) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-flagged content queue (Moderator and Admin)
router.get('/auto-flagged', requireAuth, requireRole(['MODERATOR', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string;
    const items = await getAutoFlaggedContent(status);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Take action on auto-flagged content
router.post('/auto-flagged/:id/action', requireAuth, requireRole(['MODERATOR', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { action, reason, ban_days } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Qaror tanlanishi shart' });
    }

    const result = await resolveAutoFlagged(
      req.params.id,
      req.user!.id,
      action,
      reason,
      ban_days ? parseInt(ban_days, 10) : 7
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profanity Words: List
router.get('/profanity-words', requireAuth, requireRole(['MODERATOR', 'ADMIN']), async (_req, res) => {
  try {
    const words = await getProfanityWords();
    res.json(words);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profanity Words: Add
router.post('/profanity-words', requireAuth, requireRole(['MODERATOR', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { word, severity } = req.body;
    const added = await addProfanityWord(word, severity);
    res.status(201).json(added);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Profanity Words: Delete
router.delete('/profanity-words/:id', requireAuth, requireRole(['MODERATOR', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const result = await deleteProfanityWord(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
