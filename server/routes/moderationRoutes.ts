import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireMinLevel, AuthRequest } from '../auth/telegram.ts';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import { createReport, getReports, takeModeratorAction } from '../services/moderationService.ts';
import {
  getMyQueue,
  getPool,
  claimListing,
  releaseListing,
  escalateListing,
  resolveListing,
  addTargetNote,
  getTargetNotes,
  listCannedResponses,
  createCannedResponse,
  deleteCannedResponse,
  createAppeal,
  listAppeals,
  resolveAppeal,
  listModerators,
  getTeamStats,
  ensureModeratorProfile,
  updateModeratorProfile,
} from '../services/moderationAssignService.ts';
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
router.get('/reports', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string;
    const reports = await getReports(status);
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Moderator take action (Section 33)
router.post('/action', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
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
router.get('/auto-flagged', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string;
    const items = await getAutoFlaggedContent(status);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Take action on auto-flagged content
router.post('/auto-flagged/:id/action', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
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
router.get('/profanity-words', requireAuth, requireMinLevel('MODERATOR'), async (_req, res) => {
  try {
    const words = await getProfanityWords();
    res.json(words);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profanity Words: Add
router.post('/profanity-words', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const { word, severity } = req.body;
    const added = await addProfanityWord(word, severity);
    res.status(201).json(added);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Profanity Words: Delete
router.delete('/profanity-words/:id', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const result = await deleteProfanityWord(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Faza 17: moderation distribution engine ───────────────────────────
// My queue (assigned to me)
router.get('/queue/mine', requireAuth, requireMinLevel('INTERN_MOD'), async (req: AuthRequest, res) => {
  try {
    res.json(await getMyQueue(req.user!.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Claim pool (unassigned / stale)
router.get('/queue/pool', requireAuth, requireMinLevel('INTERN_MOD'), async (req: AuthRequest, res) => {
  try {
    res.json(await getPool(req.user!.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/queue/:id/claim', requireAuth, requireMinLevel('INTERN_MOD'), async (req: AuthRequest, res) => {
  try {
    res.json(await claimListing(req.params.id, req.user!.id));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/queue/:id/release', requireAuth, requireMinLevel('INTERN_MOD'), async (req: AuthRequest, res) => {
  try {
    res.json(await releaseListing(req.params.id, req.user!.id));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/queue/:id/escalate', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    res.json(await escalateListing(req.params.id, req.user!.id, req.body.reason || 'Eskalatsiya'));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/queue/:id/resolve', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const { action, reason } = req.body;
    if (!action || !['APPROVE', 'HIDE', 'REMOVE'].includes(action)) {
      return res.status(400).json({ error: 'Amal noto\u2018g\u2018ri' });
    }
    res.json(await resolveListing(req.params.id, req.user!.id, action, reason || 'Moderator qarori'));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// User journal notes
router.get('/notes/:userId', requireAuth, requireMinLevel('INTERN_MOD'), async (req: AuthRequest, res) => {
  try {
    res.json(await getTargetNotes(req.params.userId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/notes', requireAuth, requireMinLevel('INTERN_MOD'), async (req: AuthRequest, res) => {
  try {
    const { target_user_id, note } = req.body;
    if (!target_user_id || !note) return res.status(400).json({ error: 'target_user_id va note talab qilinadi' });
    res.json(await addTargetNote(req.user!.id, target_user_id, note));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Canned responses
router.get('/canned', requireAuth, requireMinLevel('INTERN_MOD'), async (_req, res) => {
  try {
    res.json(await listCannedResponses());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/canned', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title va body talab qilinadi' });
    res.status(201).json(await createCannedResponse(req.user!.id, title, body));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/canned/:id', requireAuth, requireMinLevel('LEAD_MOD'), async (req: AuthRequest, res) => {
  try {
    res.json(await deleteCannedResponse(req.params.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Appeals (blok itirozlari)
router.post('/appeals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { report_id, listing_id, reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Sabab ko\u2018rsatilishi shart' });
    res.status(201).json(await createAppeal(req.user!.id, { report_id, listing_id, reason }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/appeals', requireAuth, requireMinLevel('LEAD_MOD'), async (req: AuthRequest, res) => {
  try {
    res.json(await listAppeals(req.query.status as string));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/appeals/:id/resolve', requireAuth, requireMinLevel('LEAD_MOD'), async (req: AuthRequest, res) => {
  try {
    const { approve, note } = req.body;
    res.json(await resolveAppeal(req.params.id, req.user!.id, !!approve, note || ''));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tasdiq nishoni (Verified badge) — moderator + admin navbati ───────────
// PENDING arizalarni ko'rish (moderator va admin).
router.get('/verifications', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const status = (req.query.status as string) || 'PENDING';
    const allowed = ['PENDING', 'VERIFIED', 'REJECTED', 'UNVERIFIED'];
    const safeStatus = allowed.includes(status) ? status : 'PENDING';
    const rows = await queryAll<any>(
      `SELECT u.id, u.name, u.profile_photo_url, u.full_legal_name, u.birth_date,
              u.pinfl, u.passport_series, u.passport_number, u.passport_issued_by,
              u.passport_issued_date, u.verification_photo_url, u.verification_status,
              u.verification_rejection_reason, u.verified_at, u.created_at,
              r.name_uz as region_name,
              (SELECT COUNT(*) FROM listings l WHERE l.owner_user_id = u.id AND l.status = 'ACTIVE') as active_listing_count
       FROM users u
       LEFT JOIN regions r ON u.region_id = r.id
       WHERE u.verification_status = ?
       ORDER BY u.updated_at DESC
       LIMIT 200`,
      [safeStatus]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bitta ariza detali
router.get('/verifications/:userId', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const row = await queryOne<any>(
      `SELECT u.*, r.name_uz as region_name
       FROM users u LEFT JOIN regions r ON u.region_id = r.id
       WHERE u.id = ?`,
      [req.params.userId]
    );
    if (!row) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Arizani tasdiqlash yoki rad etish (moderator + admin).
router.post('/verifications/:userId/action', requireAuth, requireMinLevel('MODERATOR'), async (req: AuthRequest, res) => {
  try {
    const { action, rejection_reason } = req.body || {};
    // L-03: the route param is :userId (was reading req.params.id → undefined).
    const targetUserId = req.params.userId;
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Amal noto\u2018g\u2018ri (APPROVE yoki REJECT)' });
    }
    const target = await queryOne<any>('SELECT id, verification_status FROM users WHERE id = ?', [targetUserId]);
    if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const now = new Date().toISOString();
    let notifTitle = '';
    let notifBody = '';

    if (action === 'APPROVE') {
      await runQuery(
        `UPDATE users SET
          verification_status = 'VERIFIED',
          verified_at = ?, verified_by = ?,
          verification_rejection_reason = NULL, updated_at = ?
         WHERE id = ?`,
        [now, req.user!.id, now, targetUserId]
      );
      notifTitle = 'Shaxsingiz tasdiqlandi!';
      notifBody = 'Tabriklaymiz! Sizning pasport ma\u2019lumotlaringiz tekshirilib, profilingizga rasmiy tasdiq nishoni (Verified badge) berildi.';
    } else {
      const reason = (rejection_reason || '').trim() || 'Hujjatlarda noaniqliklar mavjud';
      await runQuery(
        `UPDATE users SET
          verification_status = 'REJECTED',
          verification_rejection_reason = ?, verified_at = NULL, updated_at = ?
         WHERE id = ?`,
        [reason, now, targetUserId]
      );
      notifTitle = 'Tasdiqlash arizasi rad etildi';
      notifBody = `Tasdiqlash arizangiz rad etildi. Sabab: ${reason}`;
    }

    const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
       VALUES (?, ?, 'SYSTEM_ALERT', ?, ?, ?, ?)`,
      [notifId, targetUserId, notifTitle, notifBody, `/profile/${targetUserId}`, now]
    );

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [targetUserId]);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: moderator management + team stats ─────────────────────────
router.get('/moderators', requireAuth, requireMinLevel('ADMIN'), async (_req, res) => {
  try {
    res.json(await listModerators());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/moderators/stats', requireAuth, requireMinLevel('ADMIN'), async (_req, res) => {
  try {
    res.json(await getTeamStats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
router.put('/moderators/:userId', requireAuth, requireMinLevel('ADMIN'), async (req: AuthRequest, res) => {
  try {
    await ensureModeratorProfile(req.params.userId);
    const updated = await updateModeratorProfile(req.params.userId, req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
