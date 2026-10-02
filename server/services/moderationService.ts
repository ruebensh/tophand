import crypto from 'crypto';
import { queryAll, queryOne, runQuery } from '../db/database.ts';

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
  const targetUser = await queryOne<any>('SELECT role FROM users WHERE id = ?', [userId]);
  if (targetUser?.role === 'ADMIN') {
    throw new Error("Admin foydalanuvchini bloklab bo‘lmaydi");
  }

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

export async function adminSetRole(adminId: string, userId: string, newRole: 'USER' | 'MODERATOR') {
  const targetUser = await queryOne<any>('SELECT role FROM users WHERE id = ?', [userId]);
  if (targetUser?.role === 'ADMIN') {
    throw new Error("Admin rolini o'zgartirib bo'lmaydi");
  }

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
      newRole === 'MODERATOR' ? 'MODERATOR_ADDED' : 'MODERATOR_REMOVED',
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
