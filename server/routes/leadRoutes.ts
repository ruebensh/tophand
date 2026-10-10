import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { requireAuth, requireMinLevel, AuthRequest } from '../auth/telegram.ts';
import { queryAll } from '../db/database.ts';
import {
  adminPermanentBan,
  adminUnban,
  adminSetRole,
  adminVerifyOrganization,
  getStaffPersonalStats,
  getStaffTeamStats,
} from '../services/moderationService.ts';

// ─── Bosh moderator (LEAD_MOD) API yuzasi ────────────────────────────────
// Admin panel (`/api/admin`) `requireMinLevel('ADMIN')` bilan qoplangan — LEAD_MOD
// unga kira olmaydi. Bu alohida router LEAD_MOD'ga FAQAT kerakli funksiyalarni
// beradi: foydalanuvchilar katalogi, ban/unban, tashkilot tasdiq, moderator
// tayinlash (faqat MODERATOR darajasigacha) va skoplangan statistika.
// Taqiqlangan (bu yerda umuman yo'q): platforma sozlamalari, kategoriyalar,
// filtrlar, monetizatsiya, reklamalar, audit jurnali, Excel import/eksport.
const router = Router();

router.use(requireAuth, requireMinLevel('LEAD_MOD'));

// User directory — faqat xavfsiz ustunlar (passport matni/telefon chiqarilmaydi).
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    let sql = `
      SELECT
        u.id, u.name, u.telegram_username, u.telegram_id, u.role,
        u.verification_status, u.is_banned, u.ban_type, u.created_at,
        r.name_uz AS region_name,
        (SELECT COUNT(*) FROM listings WHERE owner_user_id = u.id) AS listings_count
      FROM users u
      LEFT JOIN regions r ON u.region_id = r.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];
    if (search.trim()) {
      conditions.push('(LOWER(u.name) LIKE ? OR LOWER(u.telegram_username) LIKE ? OR u.telegram_id LIKE ?)');
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }
    if (role) {
      conditions.push('u.role = ?');
      params.push(role);
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY u.created_at DESC LIMIT 100';
    res.json(await queryAll(sql, params));
  } catch (err: any) {
    serverError(res, err);
  }
});

// Ban / Unban (hierarchy assertCanManageActor ichida tekshiriladi).
router.post('/users/:id/ban', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Bloklash sababi ko‘rsatilishi shart' });
    res.json(await adminPermanentBan(req.user!.id, req.params.id, reason));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/users/:id/unban', async (req: AuthRequest, res) => {
  try {
    res.json(await adminUnban(req.user!.id, req.params.id));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Moderator tayinlash — Bosh moderator faqat USER/INTERN_MOD/MODERATOR qo'yadi.
// LEAD_MOD/ADMIN/SUPER_ADMIN tayinlash bu yo'l bilan MUMKIN EMAS (faqat admin).
router.post('/users/:id/role', async (req: AuthRequest, res) => {
  try {
    const { role } = req.body;
    const ALLOWED_FOR_LEAD = ['USER', 'INTERN_MOD', 'MODERATOR'];
    if (!ALLOWED_FOR_LEAD.includes(role)) {
      return res.status(400).json({ error: 'Bosh moderator faqat USER/INTERN_MOD/MODERATOR rolina tayinlay oladi' });
    }
    res.json(await adminSetRole(req.user!.id, req.params.id, role));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Organizations — ro'yxat va tasdiq.
router.get('/organizations', async (_req: AuthRequest, res) => {
  try {
    res.json(await queryAll(
      `SELECT o.*, u.name AS owner_name, u.telegram_username AS owner_username
       FROM organizations o
       JOIN users u ON o.owner_user_id = u.id
       ORDER BY o.created_at DESC`
    ));
  } catch (err: any) {
    serverError(res, err);
  }
});

router.post('/organizations/:id/verify', async (req: AuthRequest, res) => {
  try {
    const { verify } = req.body;
    res.json(await adminVerifyOrganization(req.user!.id, req.params.id, Boolean(verify)));
  } catch (err: any) {
    serverError(res, err);
  }
});

// Skoplangan statistika — shaxsiy + jamoa (admin platforma statsi EMAS).
router.get('/stats/mine', async (req: AuthRequest, res) => {
  try {
    res.json(await getStaffPersonalStats(req.user!.id));
  } catch (err: any) {
    serverError(res, err);
  }
});

router.get('/stats/team', async (_req: AuthRequest, res) => {
  try {
    res.json(await getStaffTeamStats());
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
