import crypto from 'crypto';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import { ROLE_LEVEL, type Role } from '../auth/telegram.ts';
import { deleteStoredMedia } from '../services/storageService.ts';

// SECURITY (H-09): enforce a strict role hierarchy for destructive account
// mutations (ban / unban / role change). An actor may only manage staff/users at
// a STRICTLY LOWER role level, and never themselves. This means:
//   - an ADMIN cannot touch a SUPER_ADMIN (higher) or another ADMIN (peer);
//   - a SUPER_ADMIN can manage ADMINs but not peer SUPER_ADMINs;
//   - only someone above ADMIN can act on an ADMIN.
// Previously the code only blocked "target role === ADMIN", leaving SUPER_ADMIN
// unprotected and (paradoxically) blocking even SUPER_ADMINs from managing an
// ADMIN. Fail closed when the actor cannot be resolved.
const roleLevel = (role?: string | null): number =>
  role ? (ROLE_LEVEL[role as Role] ?? -1) : -1;

async function assertCanManageActor(actorId: string, targetUserId: string, actionLabel: string): Promise<{ targetRole: string }> {
  // Report #9: bu kutilgan biznes/avtorizatsiya xatolari — mijozga ko'rsatish
  // XAVFSIZ (stack/DB emas). `status: 400` qo'yamiz, shunda chaqiruvchi route
  // `serverError` orqali 4xx xabarni ko'rsatadi, 5xx ichki xatolar esa yashiriladi.
  if (actorId === targetUserId) {
    throw Object.assign(new Error(`O'z hisobingizga “${actionLabel}” amalini bajara olmaysiz`), { status: 400 });
  }
  const [actor, target] = await Promise.all([
    queryOne<any>('SELECT role FROM users WHERE id = ?', [actorId]),
    queryOne<any>('SELECT role FROM users WHERE id = ?', [targetUserId]),
  ]);
  if (!actor) throw Object.assign(new Error('Amalni bajaruvchi topilmadi'), { status: 400 });
  if (!target) throw Object.assign(new Error('Foydalanuvchi topilmadi'), { status: 404 });
  if (roleLevel(actor.role) <= roleLevel(target.role)) {
    throw Object.assign(new Error(`Sizning darajangiz “${actionLabel}” uchun bu hisobga yetarli emas`), { status: 403 });
  }
  return { targetRole: target.role };
}

export async function createReport(reporterUserId: string, data: {
  target_type: 'LISTING' | 'USER' | 'ORGANIZATION' | 'MESSAGE' | 'CONVERSATION';
  target_id: string;
  reason: string;
  description?: string;
}) {
  const id = `rep_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  await runQuery(
    `INSERT INTO reports (id, reporter_user_id, target_type, target_id, reason, description, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [id, reporterUserId, data.target_type, data.target_id, data.reason, data.description || null, now]
  );

  return { id, status: 'PENDING' };
}

export async function getReports(status?: string) {
  let sql = `
    SELECT 
      r.*,
      u.name as reporter_name,
      u.telegram_username as reporter_username,
      rev.name as reviewer_name
    FROM reports r
    JOIN users u ON r.reporter_user_id = u.id
    LEFT JOIN users rev ON r.reviewed_by = rev.id
  `;
  const params: any[] = [];
  if (status) {
    sql += ' WHERE r.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY r.created_at DESC';

  const reports = await queryAll<any>(sql, params);

  // Hydrate target detail previews
  for (const rep of reports) {
    if (rep.target_type === 'LISTING') {
      rep.target_data = await queryOne(
        `SELECT l.id, l.title, l.status, l.type, u.name as owner_name 
         FROM listings l 
         JOIN users u ON l.owner_user_id = u.id 
         WHERE l.id = ?`,
        [rep.target_id]
      );
    } else if (rep.target_type === 'USER') {
      rep.target_data = await queryOne(
        `SELECT id, name, telegram_username, role, is_banned, ban_type, bio FROM users WHERE id = ?`,
        [rep.target_id]
      );
    } else if (rep.target_type === 'ORGANIZATION') {
      rep.target_data = await queryOne(
        `SELECT id, name, verification_status, description FROM organizations WHERE id = ?`,
        [rep.target_id]
      );
    } else if (rep.target_type === 'MESSAGE') {
      rep.target_data = await queryOne(
        `SELECT m.id, m.text, m.attachment_url, u.name as sender_name FROM messages m JOIN users u ON m.sender_user_id = u.id WHERE m.id = ?`,
        [rep.target_id]
      );
    }
  }

  return reports;
}

export async function takeModeratorAction(
  moderatorId: string,
  data: {
    report_id?: string;
    action: 'HIDE_LISTING' | 'RESTORE_LISTING' | 'REMOVE_LISTING' | 'WARN_USER' | 'TEMP_BAN_USER' | 'DISMISS_REPORT';
    target_type: 'LISTING' | 'USER' | 'ORGANIZATION' | 'MESSAGE' | 'CONVERSATION';
    target_id: string;
    reason: string;
    ban_days?: number;
  }
) {
  const now = new Date().toISOString();

  // Audit record
  const auditId = `audit_${crypto.randomUUID().slice(0, 16)}`;
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [auditId, moderatorId, data.action, data.target_type, data.target_id, JSON.stringify({ reason: data.reason, ban_days: data.ban_days }), now]
  );

  if (data.action === 'HIDE_LISTING') {
    await runQuery(`UPDATE listings SET status = 'HIDDEN', updated_at = ? WHERE id = ?`, [now, data.target_id]);
    const listing = await queryOne<any>('SELECT owner_user_id, title FROM listings WHERE id = ?', [data.target_id]);
    if (listing) {
      await runQuery(
        `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
         VALUES (?, ?, 'REPORT_ACTION', 'E’loningiz moderator tomonidan yashirildi', ?, ?, ?)`,
        [`notif_${crypto.randomUUID().slice(0, 16)}`, listing.owner_user_id, `Sabab: ${data.reason}`, `/listing/${data.target_id}`, now]
      );
    }
  } else if (data.action === 'RESTORE_LISTING') {
    await runQuery(`UPDATE listings SET status = 'ACTIVE', updated_at = ? WHERE id = ?`, [now, data.target_id]);
  } else if (data.action === 'REMOVE_LISTING') {
    await runQuery(`UPDATE listings SET status = 'REMOVED', updated_at = ? WHERE id = ?`, [now, data.target_id]);
  } else if (data.action === 'WARN_USER') {
    await runQuery(
      `INSERT INTO notifications (id, user_id, type, title, body, created_at)
       VALUES (?, ?, 'WARNING', 'Moderator ogohlantirishi', ?, ?)`,
      [`notif_${crypto.randomUUID().slice(0, 16)}`, data.target_id, `Diqqat: TopHand platformasi qoidalariga rioya qiling. Sabab: ${data.reason}`, now]
    );
  } else if (data.action === 'TEMP_BAN_USER') {
    const days = data.ban_days || 7;
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await runQuery(
      `UPDATE users 
       SET is_banned = 1, ban_type = 'TEMPORARY', ban_reason = ?, ban_end_date = ?, updated_at = ? 
       WHERE id = ?`,
      [data.reason, endDate, now, data.target_id]
    );
    await runQuery(
      `INSERT INTO notifications (id, user_id, type, title, body, created_at)
       VALUES (?, ?, 'BAN', 'Hisobingiz vaqtincha bloklandi', ?, ?)`,
      [`notif_${crypto.randomUUID().slice(0, 16)}`, data.target_id, `Bloklanish muddati: ${days} kun. Sabab: ${data.reason}`, now]
    );
  }

  // Update report if provided
  if (data.report_id) {
    const newStatus = data.action === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED';
    await runQuery(
      `UPDATE reports 
       SET status = ?, reviewed_by = ?, reviewed_at = ?, action_taken = ? 
       WHERE id = ?`,
      [newStatus, moderatorId, now, data.action, data.report_id]
    );
  }

  return { success: true };
}

export async function adminPermanentBan(adminId: string, userId: string, reason: string) {
  // H-09: strict role hierarchy (also blocks acting on self / peers / superiors).
  await assertCanManageActor(adminId, userId, 'bloklash');

  const now = new Date().toISOString();
  await runQuery(
    `UPDATE users 
     SET is_banned = 1, ban_type = 'PERMANENT', ban_reason = ?, ban_end_date = NULL, updated_at = ? 
     WHERE id = ?`,
    [reason, now, userId]
  );

  const auditId = `audit_${crypto.randomUUID().slice(0, 16)}`;
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, 'USER_PERMANENTLY_BANNED', 'USER', ?, ?, ?)`,
    [auditId, adminId, userId, JSON.stringify({ reason }), now]
  );

  return { success: true };
}

export async function adminUnban(adminId: string, userId: string) {
  // H-09: only a strictly higher-ranked actor may lift a ban.
  await assertCanManageActor(adminId, userId, 'blokdan chiqarish');

  const now = new Date().toISOString();
  await runQuery(
    `UPDATE users 
     SET is_banned = 0, ban_type = 'NONE', ban_reason = NULL, ban_end_date = NULL, updated_at = ? 
     WHERE id = ?`,
    [now, userId]
  );

  const auditId = `audit_${crypto.randomUUID().slice(0, 16)}`;
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, 'USER_UNBANNED', 'USER', ?, ?, ?)`,
    [auditId, adminId, userId, JSON.stringify({ reason: 'Admin tomonidan ochildi' }), now]
  );

  return { success: true };
}

export async function adminSetRole(adminId: string, userId: string, newRole: Role) {
  // H-09: prevent ADMIN from demoting a SUPER_ADMIN or peer, and allow
  // SUPER_ADMIN to manage ADMINs (previously wrongly blocked).
  await assertCanManageActor(adminId, userId, 'rol o‘zgartirish');

  const now = new Date().toISOString();

  // Staff roles carry an automatic, distinct verification badge — no passport
  // request needed. When a user is promoted into the moderation team we mark
  // them VERIFIED right away (and record who granted it, for the audit trail).
  const STAFF_ROLES = ['INTERN_MOD', 'MODERATOR', 'LEAD_MOD'];
  if (STAFF_ROLES.includes(newRole)) {
    await runQuery(
      `UPDATE users SET role = ?, updated_at = ?, verification_status = 'VERIFIED', verified_at = ?, verified_by = ?, verification_rejection_reason = NULL WHERE id = ?`,
      [newRole, now, now, adminId, userId]
    );
  } else {
    await runQuery(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`, [newRole, now, userId]);
  }

  const auditId = `audit_${crypto.randomUUID().slice(0, 16)}`;
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, 'USER', ?, ?, ?)`,
    [
      auditId,
      adminId,
      STAFF_ROLES.includes(newRole) ? 'MODERATOR_ADDED' : 'MODERATOR_REMOVED',
      userId,
      JSON.stringify({ newRole }),
      now,
    ]
  );

  return { success: true };
}

export async function adminVerifyOrganization(adminId: string, orgId: string, verify: boolean) {
  const now = new Date().toISOString();
  const status = verify ? 'VERIFIED' : 'UNVERIFIED';

  await runQuery(
    `UPDATE organizations 
     SET verification_status = ?, verified_at = ?, verified_by = ?, updated_at = ? 
     WHERE id = ?`,
    [status, verify ? now : null, verify ? adminId : null, now, orgId]
  );

  const auditId = `audit_${crypto.randomUUID().slice(0, 16)}`;
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, 'ORGANIZATION', ?, ?, ?)`,
    [
      auditId,
      adminId,
      verify ? 'ORGANIZATION_VERIFIED' : 'ORGANIZATION_UNVERIFIED',
      orgId,
      JSON.stringify({ status }),
      now,
    ]
  );

  return { success: true };
}

export async function getAdminOverview() {
  const usersCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  const activeListingsCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM listings WHERE status = 'ACTIVE'");
  const archivedListingsCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM listings WHERE status IN ('ARCHIVED', 'COMPLETED')");
  const pendingReportsCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM reports WHERE status = 'PENDING'");
  const orgsCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM organizations');
  const verifiedOrgsCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM organizations WHERE verification_status = 'VERIFIED'");
  const moderatorsCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE role = 'MODERATOR'");
  const bannedCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE is_banned = 1");

  return {
    total_users: usersCount?.count || 0,
    active_listings: activeListingsCount?.count || 0,
    archived_listings: archivedListingsCount?.count || 0,
    pending_reports: pendingReportsCount?.count || 0,
    total_organizations: orgsCount?.count || 0,
    verified_organizations: verifiedOrgsCount?.count || 0,
    moderators_count: moderatorsCount?.count || 0,
    banned_users: bannedCount?.count || 0,
  };
}

/**
 * LEGAL (F-07 davomi): pasport/selfie RASMLARI tasdiq qaroridan (APPROVE yoki
 * REJECT) keyin SAQLANMASLIGI kerak. Bu funksiya foydalanuvchiga bog'langan barcha
 * yopiq obyektlarni o'chiradi, `users.verification_photo_url` havolasini tozalaydi
 * va `verification_uploads` satrlarini bekor qiladi. MATN pasport ma'lumotlari
 * (seriya/raqam/PINFL) qoladi — takror ariza oldini olish uchun kerak; faqat
 * RASM baytlari o'chadi. Obyekt o'chirish `deleteStoredMedia` orqali (xatoda
 * DURABLE retry navbatiga tushadi), DB tozalash esa shu yerda bajariladi.
 * MUHIM (report #1): DB so'rovi xato bersa xato CHAQIRUVCHIGA TARQADI — shunda
 * API "success" qaytarmaydi va holat PENDING bo'lib qoladi (qayta uriladi),
 * aks holda xatolik yashirilib, havolalar bazada qolib ketardi.
 */
export async function purgeVerificationMedia(userId: string): Promise<void> {
  const rows = await queryAll<{ object_key: string }>(
    'SELECT object_key FROM verification_uploads WHERE owner_user_id = ?',
    [userId]
  );
  const user = await queryOne<{ verification_photo_url: string | null }>(
    'SELECT verification_photo_url FROM users WHERE id = ?',
    [userId]
  );
  const refs = new Set<string>();
  for (const r of rows) if (r?.object_key) refs.add(r.object_key);
  if (user?.verification_photo_url) refs.add(user.verification_photo_url);
  // Obyektlarni o'chiramiz (durable-retry ichida; o'zi throw qilmaydi), SO'NG DB
  // havolalarini tozalaymiz. DB xatosi yuqoriga tarqaladi (catch QILINMAYDI).
  await Promise.all(Array.from(refs).map((ref) => deleteStoredMedia(ref)));
  await runQuery('DELETE FROM verification_uploads WHERE owner_user_id = ?', [userId]);
  await runQuery(
    'UPDATE users SET verification_photo_url = NULL, verification_upload_id = NULL WHERE id = ?',
    [userId]
  );
}

// ─── Bosh moderator (LEAD_MOD) uchun SKOPLANGAN statistika ────────────────
// Faqat staff (moderator/lead) ish faoliyati — platforma/admin umumiy stats
// EMAS. Manba: audit_logs (har bir staff harakati actor_user_id bilan yoziladi).
function statsBuckets(): string {
  return `
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE action ILIKE '%APPROV%' OR action ILIKE '%VERIFIED%' OR action ILIKE '%RESTORE%') AS approvals,
    COUNT(*) FILTER (WHERE action ILIKE '%HIDE%' OR action ILIKE '%REMOVE%' OR action ILIKE '%REJECT%' OR action ILIKE '%UNVERIFIED%') AS removals,
    COUNT(*) FILTER (WHERE action ILIKE '%BAN%') AS bans,
    COUNT(*) FILTER (WHERE action ILIKE '%MODERATOR%') AS role_changes,
    COUNT(*) FILTER (WHERE action ILIKE '%VERIF%') AS verifications
  `;
}

/** Aktoorning shaxsiy 30 kunlik ish statistikasi. */
export async function getStaffPersonalStats(actorId: string) {
  const totals = await queryOne<any>(
    `SELECT ${statsBuckets()} FROM audit_logs
     WHERE actor_user_id = ? AND created_at >= NOW() - INTERVAL '30 days'`,
    [actorId]
  );
  const series = await queryAll<{ day: string; count: number }>(
    `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
     FROM audit_logs
     WHERE actor_user_id = ? AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY day ORDER BY day`,
    [actorId]
  );
  const num = (v: any) => Number(v || 0);
  return {
    window_days: 30,
    totals: {
      total: num(totals?.total),
      approvals: num(totals?.approvals),
      removals: num(totals?.removals),
      bans: num(totals?.bans),
      role_changes: num(totals?.role_changes),
      verifications: num(totals?.verifications),
    },
    series,
  };
}

/** Jamoa (barcha moderator/lead) 30 kunlik ish statistikasi. */
export async function getStaffTeamStats() {
  const rows = await queryAll<any>(
    `SELECT u.id, u.name, u.role,
       COUNT(a.id) AS total,
       COUNT(*) FILTER (WHERE a.action ILIKE '%APPROV%' OR a.action ILIKE '%VERIFIED%' OR a.action ILIKE '%RESTORE%') AS approvals,
       COUNT(*) FILTER (WHERE a.action ILIKE '%HIDE%' OR a.action ILIKE '%REMOVE%' OR a.action ILIKE '%REJECT%' OR a.action ILIKE '%UNVERIFIED%') AS removals,
       COUNT(*) FILTER (WHERE a.action ILIKE '%BAN%') AS bans,
       COUNT(*) FILTER (WHERE a.action ILIKE '%VERIF%') AS verifications
     FROM users u
     LEFT JOIN audit_logs a ON a.actor_user_id = u.id AND a.created_at >= NOW() - INTERVAL '30 days'
     WHERE u.role IN ('INTERN_MOD', 'MODERATOR', 'LEAD_MOD')
     GROUP BY u.id, u.name, u.role
     ORDER BY total DESC`
  );
  const num = (v: any) => Number(v || 0);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    total: num(r.total),
    approvals: num(r.approvals),
    removals: num(r.removals),
    bans: num(r.bans),
    verifications: num(r.verifications),
  }));
}

