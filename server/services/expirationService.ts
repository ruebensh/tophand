import crypto from 'crypto';
import { queryAll, runQuery } from '../db/database.ts';

export async function processListingExpirations() {
  const now = new Date().toISOString();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Check for expired listings (ACTIVE -> ARCHIVED)
  const expiredListings = await queryAll<{ id: string; owner_user_id: string; title: string }>(
    `SELECT id, owner_user_id, title FROM listings WHERE status = 'ACTIVE' AND expires_at <= ?`,
    [now]
  );

  for (const l of expiredListings) {
    await runQuery(
      `UPDATE listings SET status = 'ARCHIVED', archived_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, l.id]
    );

    const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
       VALUES (?, ?, 'LISTING_EXPIRED', 'E’loningiz muddati tugadi', ?, ?, ?)`,
      [
        notifId,
        l.owner_user_id,
        `"${l.title}" nomli e’loningizning amal qilish muddati tugadi va arxivga o‘tkazildi. Uni istalgan vaqtda bepul uzaytirishingiz mumkin.`,
        `/profile/${l.owner_user_id}`,
        now,
      ]
    );
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const expiringSoonListings = await queryAll<{ id: string; owner_user_id: string; title: string }>(
    `SELECT id, owner_user_id, title FROM listings 
     WHERE status = 'ACTIVE' 
       AND expires_at <= ? 
       AND expires_at > ?
       AND id NOT IN (
         SELECT link FROM notifications 
         WHERE type = 'LISTING_EXPIRING' AND created_at >= ?
       )`,
    [threeDaysFromNow, now, threeDaysAgo]
  );

  for (const l of expiringSoonListings) {
    const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
    await runQuery(
      `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
       VALUES (?, ?, 'LISTING_EXPIRING', 'E’lon muddati tugashiga 3 kun qoldi', ?, ?, ?)`,
      [
        notifId,
        l.owner_user_id,
        `"${l.title}" nomli e’loningizning amal qilish muddati tugashiga 3 kun qoldi. Uni yana 30 kunga uzaytirishingiz mumkin.`,
        `/listing/${l.id}`,
        now,
      ]
    );
  }

  return {
    archived_count: expiredListings.length,
    warned_count: expiringSoonListings.length,
  };
}

export function startExpirationCron() {
  // Run once at startup
  processListingExpirations().catch((err) =>
    console.error('Error running initial listing expiration job:', err)
  );

  // Run every 30 minutes
  setInterval(() => {
    processListingExpirations().catch((err) =>
      console.error('Error running periodic listing expiration job:', err)
    );
  }, 30 * 60 * 1000);
}
