import webpush from 'web-push';
import { queryAll, runQuery } from '../db/database.ts';

// ─── VAPID configuration ───────────────────────────────────────────────
// Keys are generated once (npm script / web-push CLI) and stored in .env.
// When they are absent (e.g. a fresh local clone), push is simply disabled —
// in-app notifications keep working exactly as before.
const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@tophand.uz';

let configured = false;
if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (err) {
    console.error('Web Push: invalid VAPID keys, push disabled:', (err as Error).message);
  }
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getPublicKey(): string {
  return publicKey;
}

export interface PushPayload {
  title: string;
  body: string;
  /** In-app route to open when the notification is clicked. */
  url?: string;
  /** Optional tag so multiple pushes for the same thing replace each other. */
  tag?: string;
  icon?: string;
}

const PUSH_ICON = '/TOPHAND.uz (1).png';

/**
 * Send a Web Push notification to every device subscribed by a user.
 * Fire-and-forget safe: never throws. Subscriptions the push service reports
 * as gone (404/410) are pruned automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configured || !userId) return;
  try {
    const subs = await queryAll<{ endpoint: string; p256dh: string; auth: string }>(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );
    if (!subs.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      tag: payload.tag,
      icon: payload.icon || PUSH_ICON,
      badge: PUSH_ICON,
      timestamp: new Date().toISOString(),
    });

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err: any) {
          // 404/410 → the subscription is no longer valid; drop it.
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await runQuery('DELETE FROM push_subscriptions WHERE endpoint = ?', [s.endpoint]).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    console.error('sendPushToUser failed:', (err as Error).message);
  }
}

/** Persist (or refresh) a subscription, associating it with a user. */
export async function saveSubscription(
  userId: string | null,
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<void> {
  await runQuery(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth`,
    [endpoint, userId, p256dh, auth]
  );
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await runQuery('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
}

export async function hasSubscription(userId: string): Promise<boolean> {
  const row = await queryAll('SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1', [userId]);
  return row.length > 0;
}
