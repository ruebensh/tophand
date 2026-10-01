import crypto from 'crypto';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import { scanTextForProfanity } from './autoModerationService.ts';
import { hasMinLevel, Role } from '../auth/telegram.ts';

// ─── Settings helper ───────────────────────────────────────────────────
async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await queryOne<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
  return row?.value ?? fallback;
}

export async function isAutoApproveEnabled(): Promise<boolean> {
  const v = await getSetting('auto_approve_enabled', '0');
  return v === '1' || v === 'true';
}

// SLA hours by priority (hours until due). Configurable later; sensible defaults here.
const SLA_HOURS: Record<string, number> = { P0: 1, P1: 4, P2: 24, P3: 72 };

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ─── Moderator profiles ────────────────────────────────────────────────
export interface ModeratorProfilePatch {
  level?: string;
  max_open_tasks?: number;
  specialty_catalogs?: string[];
  regions?: string[];
  langs?: string[];
  can_message_users?: boolean;
  is_active?: boolean;
}

export async function ensureModeratorProfile(userId: string, patch: ModeratorProfilePatch = {}) {
  await runQuery(
    `INSERT INTO moderator_profiles (user_id, level, max_open_tasks, can_message_users)
     VALUES (?, 'MODERATOR', 10, false)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  if (Object.keys(patch).length > 0) await updateModeratorProfile(userId, patch);
  return getModeratorProfile(userId);
}

export async function getModeratorProfile(userId: string) {
  return queryOne<any>('SELECT * FROM moderator_profiles WHERE user_id = ?', [userId]);
}

export async function updateModeratorProfile(userId: string, patch: ModeratorProfilePatch) {
  const sets: string[] = [];
  const params: any[] = [];
  const push = (col: string, val: any) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };
  if (patch.level !== undefined) push('level', patch.level);
  if (patch.max_open_tasks !== undefined) push('max_open_tasks', patch.max_open_tasks);
  if (patch.specialty_catalogs !== undefined) push('specialty_catalogs', patch.specialty_catalogs);
  if (patch.regions !== undefined) push('regions', patch.regions);
  if (patch.langs !== undefined) push('langs', patch.langs);
  if (patch.can_message_users !== undefined) push('can_message_users', patch.can_message_users);
  if (patch.is_active !== undefined) push('is_active', patch.is_active);
  sets.push('updated_at = NOW()');
  params.push(userId);
  await runQuery(`UPDATE moderator_profiles SET ${sets.join(', ')} WHERE user_id = ?`, params);
  return getModeratorProfile(userId);
}

async function openTaskCount(moderatorId: string): Promise<number> {
  const row = await queryOne<{ count: number | string }>(
    `SELECT COUNT(*) as count FROM listings
     WHERE assigned_moderator_id = ? AND review_status IN ('IN_PROGRESS','ESCALATED')
       AND (claimed_at IS NULL OR claimed_at > NOW() - INTERVAL '6 hours')`,
    [moderatorId]
  );
  return Number(row?.count || 0);
}

/** Active moderators (staff users with a profile, ordered least-loaded first). */
export async function listModerators() {
  const mods = await queryAll<any>(
    `SELECT u.id, u.name, u.role, u.telegram_username,
            mp.level, mp.max_open_tasks, mp.specialty_catalogs, mp.regions, mp.langs,
            mp.can_message_users, mp.is_active
     FROM users u
     JOIN moderator_profiles mp ON mp.user_id = u.id
     WHERE u.role <> 'USER'
     ORDER BY mp.is_active DESC, u.name ASC`
  );
  for (const m of mods) {
    m.open_tasks = await openTaskCount(m.id);
  }
  return mods;
}

/**
 * Pick the best active moderator for a task: prefer those whose specialty
 * (catalog) and region match, then least-loaded. Falls back to any active
 * moderator with capacity, else null (task stays in the pool).
 */
async function pickModerator(opts: { catalogId?: string; regionId?: string; excludeId?: string }): Promise<string | null> {
  const candidates = await queryAll<any>(
    `SELECT mp.user_id, mp.max_open_tasks, mp.specialty_catalogs, mp.regions
     FROM moderator_profiles mp
     JOIN users u ON u.id = mp.user_id
     WHERE mp.is_active = true AND u.role <> 'USER' AND u.is_banned = 0
       ${opts.excludeId ? 'AND mp.user_id <> ?' : ''}`,
    opts.excludeId ? [opts.excludeId] : []
  );

  const scored: { id: string; score: number; load: number; cap: number }[] = [];
  for (const c of candidates) {
    const load = await openTaskCount(c.user_id);
    const cap = Number(c.max_open_tasks || 10);
    if (load >= cap) continue; // over capacity
    let score = 0;
    if (opts.catalogId && Array.isArray(c.specialty_catalogs) && c.specialty_catalogs.includes(opts.catalogId)) score += 2;
    if (opts.regionId && Array.isArray(c.regions) && c.regions.includes(opts.regionId)) score += 1;
    scored.push({ id: c.user_id, score, load, cap });
  }
  if (scored.length === 0) return null;
  // Highest specialty/region match, then least-loaded.
  scored.sort((a, b) => (b.score - a.score) || (a.load - b.load) || (a.cap - b.cap));
  return scored[0].id;
}

async function bumpStat(moderatorId: string, field: 'tasks_resolved' | 'tasks_claimed' | 'escalations') {
  const day = new Date().toISOString().slice(0, 10);
  await runQuery(
    `INSERT INTO moderator_stats (id, moderator_id, day, ${field})
     VALUES (?, ?, ?, 1)
     ON CONFLICT (moderator_id, day) DO UPDATE SET ${field} = moderator_stats.${field} + 1`,
    [newId('ms'), moderatorId, day]
  );
}

// ─── Queue / assignment engine ─────────────────────────────────────────
/**
 * Enqueue a freshly-created listing for moderation. If auto-approve is on and
 * content is clean (no profanity), it is resolved immediately; otherwise it is
 * assigned to the least-loaded matching moderator (or left in the pool).
 */
export async function enqueueListing(listingId: string): Promise<void> {
  try {
    const listing = await queryOne<any>(
      `SELECT l.id, l.title, l.description, l.region_id, c.catalog_id
       FROM listings l LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.id = ?`,
      [listingId]
    );
    if (!listing) return;

    const { isFlagged } = await scanTextForProfanity(`${listing.title || ''} ${listing.description || ''}`);
    const priority = isFlagged ? 'P1' : 'P2';
    const slaHours = SLA_HOURS[priority] ?? 24;

    // Auto-triage: clean + auto-approve enabled → skip the queue.
    if (!isFlagged && (await isAutoApproveEnabled())) {
      await runQuery(
        `UPDATE listings SET review_status = 'RESOLVED', assigned_moderator_id = NULL, sla_due_at = NULL WHERE id = ?`,
        [listingId]
      );
      return;
    }

    await runQuery(
      `UPDATE listings
       SET review_status = 'UNASSIGNED', priority = ?, sla_due_at = NOW() + (? || ' hours')::INTERVAL
       WHERE id = ?`,
      [priority, String(slaHours), listingId]
    );

    const moderatorId = await pickModerator({ catalogId: listing.catalog_id, regionId: listing.region_id });
    if (moderatorId) {
      await runQuery(
        `UPDATE listings SET assigned_moderator_id = ?, review_status = 'IN_PROGRESS', claimed_at = NOW() WHERE id = ?`,
        [moderatorId, listingId]
      );
    }
  } catch (err) {
    console.error('enqueueListing error:', err);
  }
}

export async function getMyQueue(moderatorId: string) {
  return queryAll<any>(
    `SELECT l.id, l.title, l.status, l.type, l.priority, l.review_status, l.claimed_at, l.sla_due_at,
            l.created_at, u.name as owner_name, c.name_uz as category_name
     FROM listings l
     LEFT JOIN users u ON u.id = l.owner_user_id
     LEFT JOIN categories c ON c.id = l.category_id
     WHERE l.assigned_moderator_id = ?
       AND l.review_status IN ('IN_PROGRESS','ESCALATED')
     ORDER BY
       CASE l.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END ASC,
       l.sla_due_at ASC NULLS LAST, l.created_at DESC`,
    [moderatorId]
  );
}

/** Unassigned (pool) tasks — visible to all moderators to claim. */
export async function getPool(moderatorId: string) {
  void moderatorId;
  return queryAll<any>(
    `SELECT l.id, l.title, l.status, l.type, l.priority, l.review_status, l.sla_due_at, l.created_at,
            u.name as owner_name, c.name_uz as category_name, c.catalog_id
     FROM listings l
     LEFT JOIN users u ON u.id = l.owner_user_id
     LEFT JOIN categories c ON c.id = l.category_id
     WHERE l.review_status = 'UNASSIGNED'
        OR (l.review_status = 'IN_PROGRESS' AND l.claimed_at < NOW() - INTERVAL '6 hours')
     ORDER BY
       CASE l.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END ASC,
       l.created_at DESC
     LIMIT 100`
  );
}

export async function claimListing(listingId: string, moderatorId: string) {
  const listing = await queryOne<any>('SELECT id, assigned_moderator_id, review_status FROM listings WHERE id = ?', [listingId]);
  if (!listing) throw new Error("E'lon topilmadi");
  const profile = await getModeratorProfile(moderatorId);
  const cap = Number(profile?.max_open_tasks || 10);
  if ((await openTaskCount(moderatorId)) >= cap) {
    throw new Error(`Ish hajmi to'lgan (max ${cap} ochiq vazifa). Avval mavjudlarini yopish.`);
  }
  await runQuery(
    `UPDATE listings SET assigned_moderator_id = ?, review_status = 'IN_PROGRESS', claimed_at = NOW() WHERE id = ?`,
    [moderatorId, listingId]
  );
  await bumpStat(moderatorId, 'tasks_claimed');
  return queryOne('SELECT id, assigned_moderator_id, review_status, claimed_at FROM listings WHERE id = ?', [listingId]);
}

export async function releaseListing(listingId: string, moderatorId: string) {
  void moderatorId;
  await runQuery(
    `UPDATE listings SET assigned_moderator_id = NULL, review_status = 'UNASSIGNED', claimed_at = NULL WHERE id = ?`,
    [listingId]
  );
  return { success: true };
}

async function moderatorRole(userId: string): Promise<Role> {
  const u = await queryOne<{ role: Role }>('SELECT role FROM users WHERE id = ?', [userId]);
  return (u?.role as Role) || 'USER';
}

export async function escalateListing(listingId: string, moderatorId: string, reason: string) {
  await runQuery(
    `UPDATE listings SET review_status = 'ESCALATED', priority = 'P0', claimed_at = NOW() WHERE id = ?`,
    [listingId]
  );
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, 'MOD_ESCALATE', 'LISTING', ?, ?, ?)`,
    [newId('audit'), moderatorId, listingId, JSON.stringify({ reason }), now]
  );
  await bumpStat(moderatorId, 'escalations');
  return { success: true };
}

/**
 * Resolve a moderated listing. action:
 *  APPROVE → keep/restore ACTIVE
 *  HIDE    → status HIDDEN
 *  REMOVE  → status REMOVED
 */
export async function resolveListing(
  listingId: string,
  moderatorId: string,
  action: 'APPROVE' | 'HIDE' | 'REMOVE',
  reason: string
) {
  const now = new Date().toISOString();
  const listingStatus = action === 'APPROVE' ? 'ACTIVE' : action === 'HIDE' ? 'HIDDEN' : 'REMOVED';
  await runQuery(
    `UPDATE listings SET review_status = 'RESOLVED', status = ?, updated_at = ? WHERE id = ?`,
    [listingStatus, now, listingId]
  );
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, 'LISTING', ?, ?, ?)`,
    [newId('audit'), moderatorId, `MOD_${action}`, listingId, JSON.stringify({ reason }), now]
  );
  await bumpStat(moderatorId, 'tasks_resolved');
  return { success: true, action };
}

// ─── Notes ─────────────────────────────────────────────────────────────
export async function addTargetNote(moderatorId: string, targetUserId: string, note: string) {
  await runQuery(
    'INSERT INTO moderation_notes (id, moderator_id, target_user_id, note, created_at) VALUES (?, ?, ?, ?, NOW())',
    [newId('note'), moderatorId, targetUserId, note]
  );
  return { success: true };
}

export async function getTargetNotes(targetUserId: string) {
  return queryAll<any>(
    `SELECT n.*, u.name as moderator_name
     FROM moderation_notes n JOIN users u ON u.id = n.moderator_id
     WHERE n.target_user_id = ? ORDER BY n.created_at DESC`,
    [targetUserId]
  );
}

// ─── Canned responses ──────────────────────────────────────────────────
export async function listCannedResponses() {
  return queryAll<any>('SELECT * FROM canned_responses ORDER BY created_at DESC');
}
export async function createCannedResponse(creatorId: string, title: string, body: string) {
  const id = newId('canned');
  await runQuery('INSERT INTO canned_responses (id, title, body, created_by) VALUES (?, ?, ?, ?)', [id, title, body, creatorId]);
  return queryOne('SELECT * FROM canned_responses WHERE id = ?', [id]);
}
export async function deleteCannedResponse(id: string) {
  await runQuery('DELETE FROM canned_responses WHERE id = ?', [id]);
  return { success: true };
}

// ─── Appeals ───────────────────────────────────────────────────────────
export async function createAppeal(userId: string, data: { report_id?: string; listing_id?: string; reason: string }) {
  const id = newId('app');
  await runQuery(
    `INSERT INTO appeals (id, user_id, report_id, listing_id, reason, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [id, userId, data.report_id || null, data.listing_id || null, data.reason]
  );
  return { id, status: 'PENDING' };
}
export async function listAppeals(status?: string) {
  let sql = `SELECT a.*, u.name as user_name, res.name as resolver_name
             FROM appeals a JOIN users u ON u.id = a.user_id
             LEFT JOIN users res ON res.id = a.resolved_by`;
  const params: any[] = [];
  if (status) { sql += ' WHERE a.status = ?'; params.push(status); }
  sql += ' ORDER BY a.created_at DESC';
  return queryAll<any>(sql, params);
}
export async function resolveAppeal(appealId: string, resolverId: string, approve: boolean, note: string) {
  const now = new Date().toISOString();
  await runQuery(
    `UPDATE appeals SET status = ?, resolved_by = ?, resolution_note = ?, resolved_at = ? WHERE id = ?`,
    [approve ? 'APPROVED' : 'REJECTED', resolverId, note, now, appealId]
  );
  if (approve) {
    const appeal = await queryOne<any>('SELECT user_id FROM appeals WHERE id = ?', [appealId]);
    if (appeal) {
      await runQuery(
        `UPDATE users SET is_banned = 0, ban_type = 'NONE', ban_reason = NULL, ban_end_date = NULL, updated_at = ? WHERE id = ?`,
        [now, appeal.user_id]
      );
    }
  }
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, 'APPEAL', ?, ?, ?)`,
    [newId('audit'), resolverId, approve ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED', appealId, JSON.stringify({ note }), now]
  );
  return { success: true };
}

// ─── Team stats / leaderboard ──────────────────────────────────────────
export async function getTeamStats() {
  return queryAll<any>(
    `SELECT ms.moderator_id, u.name, u.role,
            SUM(ms.tasks_resolved) as tasks_resolved,
            SUM(ms.tasks_claimed) as tasks_claimed,
            SUM(ms.escalations) as escalations
     FROM moderator_stats ms JOIN users u ON u.id = ms.moderator_id
     GROUP BY ms.moderator_id, u.name, u.role
     ORDER BY tasks_resolved DESC`
  );
}
