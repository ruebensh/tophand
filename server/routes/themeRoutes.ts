import { Router } from 'express';
import { queryOne, runQuery } from '../db/database.ts';
import { requireAuth, AuthRequest } from '../auth/telegram.ts';

const router = Router();

// ─── system_settings helpers ────────────────────────────────────────────
async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM system_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

async function setSetting(key: string, value: string, updatedBy?: string): Promise<void> {
  await runQuery(
    `INSERT INTO system_settings (key, value, updated_at, updated_by)
     VALUES (?, ?, NOW(), ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [key, value, updatedBy ?? 'system']
  );
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
function requireAdmin(req: AuthRequest, res: any): boolean {
  if (!ADMIN_ROLES.includes(req.user?.role as any)) {
    res.status(403).json({ error: "Faqat administrator o'zgartira oladi" });
    return false;
  }
  return true;
}

// ─── Public: barcha mavzu konfiguratsiyasi ───────────────────────────────
router.get('/config', async (_req, res) => {
  try {
    const [holidaysRaw, regionRaw, overrideRaw] = await Promise.all([
      getSetting('holidays'),
      getSetting('region_themes'),
      getSetting('theme_override'),
    ]);
    res.json({
      holidays: parseJson(holidaysRaw, null),
      regionThemes: parseJson(regionRaw, null),
      override: parseJson(overrideRaw, null),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: bayramlar ro'yxatini saqlash ─────────────────────────────────
router.put('/holidays', requireAuth, async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const list = req.body?.holidays;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: '`holidays` massivi kerak' });
    }
    await setSetting('holidays', JSON.stringify(list), req.user!.id);
    res.json({ success: true, count: list.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: hudud mavzularini saqlash ────────────────────────────────────
router.put('/region-themes', requireAuth, async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const themes = req.body?.regionThemes;
    if (!themes || typeof themes !== 'object') {
      return res.status(400).json({ error: '`regionThemes` obyekti kerak' });
    }
    await setSetting('region_themes', JSON.stringify(themes), req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: mavzu override (test/preview — hamma uchun) ──────────────────
router.put('/override', requireAuth, async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const override = req.body?.override; // {type:'holiday'|'region'|'none', id?} | null
    if (!override || override.type === 'none') {
      await setSetting('theme_override', JSON.stringify({ type: 'none' }), req.user!.id);
      return res.json({ success: true, override: { type: 'none' } });
    }
    if (override.type !== 'holiday' && override.type !== 'region') {
      return res.status(400).json({ error: "type 'holiday' yoki 'region' bo'lishi kerak" });
    }
    await setSetting(
      'theme_override',
      JSON.stringify({ type: override.type, id: override.id }),
      req.user!.id
    );
    res.json({ success: true, override: { type: override.type, id: override.id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
