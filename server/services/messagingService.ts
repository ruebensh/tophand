import crypto from 'crypto';
import { queryAll, queryOne, runQuery, runTransaction } from '../db/database.ts';
import type { PoolClient } from 'pg';
import { hasMinLevel, Role } from '../auth/telegram.ts';
import { signTopHand } from './notificationService.ts';
import { sendPushToUser } from './pushService.ts';

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Can this staff member send messages on behalf of TopHand?
 * Admin/Super/Lead always can; INTERN/MOD only if granted can_message_users.
 */
export async function canUserMessage(role: string, userId: string): Promise<boolean> {
  if (hasMinLevel(role as Role, 'LEAD_MOD')) return true;
  if (hasMinLevel(role as Role, 'INTERN_MOD')) {
    const prof = await queryOne<{ can_message_users: boolean }>(
      'SELECT can_message_users FROM moderator_profiles WHERE user_id = ?',
      [userId]
    );
    return !!prof?.can_message_users;
  }
  return false;
}

export interface RecipientSpec {
  all?: boolean;
  user_ids?: string[];
  filter?: { role?: string; region_id?: string; banned?: boolean };
}

async function resolveRecipients(spec: RecipientSpec): Promise<{ id: string; name: string; username?: string }[]> {
  if (spec.all) {
    return queryAll(
      `SELECT id, name, telegram_username as username FROM users WHERE is_banned = 0`
    );
  }
  if (Array.isArray(spec.user_ids) && spec.user_ids.length > 0) {
    const placeholders = spec.user_ids.map(() => '?').join(',');
    return queryAll(
      `SELECT id, name, telegram_username as username FROM users WHERE id IN (${placeholders})`,
      spec.user_ids
    );
  }
  if (spec.filter) {
    const where: string[] = [];
    const params: any[] = [];
    if (spec.filter.role) { where.push('role = ?'); params.push(spec.filter.role); }
    if (spec.filter.region_id) { where.push('region_id = ?'); params.push(spec.filter.region_id); }
    where.push(spec.filter.banned === undefined ? 'is_banned = 0' : spec.filter.banned ? 'is_banned = 1' : 'is_banned = 0');
    return queryAll(
      `SELECT id, name, telegram_username as username FROM users WHERE ${where.join(' AND ')}`,
      params
    );
  }
  return [];
}

function renderBody(template: string, r: { name: string; username?: string }): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/g, r.name || '')
    .replace(/\{\{\s*username\s*\}\}/g, r.username ? `@${r.username}` : '');
}

export interface SendMessageInput {
  senderId: string;
  senderRole: string;
  recipients: RecipientSpec;
  mode?: 'BROADCAST' | 'PER_USER';
  subject?: string;
  body: string;
  link?: string;
}

export async function sendStaffMessage(input: SendMessageInput) {
  const users = await resolveRecipients(input.recipients);
  if (users.length === 0) {
    return { sent: 0, message_id: null };
  }

  const mode = input.mode || 'BROADCAST';
  const now = new Date().toISOString();
  const messageId = newId('sm');
  const scope = input.recipients.all
    ? 'ALL'
    : Array.isArray(input.recipients.user_ids)
    ? `SELECTED:${input.recipients.user_ids.length}`
    : 'FILTER';

  const title = input.subject || 'TopHand xabari';

  // Chunked, transactional notification fan-out.
  const CHUNK = 500;
  for (let i = 0; i < users.length; i += CHUNK) {
    const batch = users.slice(i, i + CHUNK);
    await runTransaction(async (client: PoolClient) => {
      for (const u of batch) {
        const body = mode === 'PER_USER' ? renderBody(input.body, u) : input.body;
        // Every TopHand broadcast (holidays, events, announcements) is signed.
        await client.query(
          `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
           VALUES ($1, $2, 'SYSTEM_ALERT', $3, $4, $5, $6)`,
          [newId('notif'), u.id, title, signTopHand(body), input.link || null, now]
        );
      }
    });

    // Web Push fan-out (fire-and-forget) after the batch is committed, so
    // announcements reach users even when the site is closed.
    for (const u of batch) {
      const body = mode === 'PER_USER' ? renderBody(input.body, u) : input.body;
      sendPushToUser(u.id, { title, body, url: input.link || '/notifications', tag: 'SYSTEM_ALERT' }).catch(() => {});
    }
  }

  // Record the broadcast + audit
  await runQuery(
    `INSERT INTO staff_messages (id, sender_id, sender_role, scope, mode, recipient_count, subject, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [messageId, input.senderId, input.senderRole, scope, mode, users.length, input.subject || null, input.body, now]
  );
  await runQuery(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, 'SEND_MESSAGE', 'STAFF_MESSAGE', ?, ?, ?)`,
    [newId('audit'), input.senderId, messageId, JSON.stringify({ scope, mode, count: users.length, subject: input.subject }), now]
  );

  return { sent: users.length, message_id: messageId };
}

/**
 * Lightweight, PII-safe user directory for staff message recipient picking.
 * Available to any staff member granted messaging access (admin/lead always,
 * intern/mod only with can_message_users). Never returns passport/pinfl/phone.
 */
export async function listSelectableUsers(search?: string) {
  const where: string[] = [];
  const params: any[] = [];
  if (search && search.trim()) {
    where.push('(LOWER(u.name) LIKE ? OR LOWER(u.telegram_username) LIKE ? OR u.telegram_id LIKE ?)');
    const term = `%${search.trim().toLowerCase()}%`;
    params.push(term, term, term);
  }
  const sql = `
    SELECT u.id, u.name, u.telegram_username, u.role, u.is_banned,
           r.name_uz AS region_name,
           (SELECT COUNT(*) FROM listings WHERE owner_user_id = u.id) AS listings_count
    FROM users u
    LEFT JOIN regions r ON u.region_id = r.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY u.created_at DESC LIMIT 100
  `;
  return queryAll(sql, params);
}

export async function getMessagingHistory(senderId?: string) {
  if (senderId) {
    return queryAll<any>('SELECT * FROM staff_messages WHERE sender_id = ? ORDER BY created_at DESC LIMIT 100', [senderId]);
  }
  return queryAll<any>(
    `SELECT sm.*, u.name as sender_name FROM staff_messages sm JOIN users u ON u.id = sm.sender_id ORDER BY sm.created_at DESC LIMIT 100`
  );
}
