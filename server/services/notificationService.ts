import crypto from 'crypto';
import { runQuery } from '../db/database.ts';
import { sendPushToUser } from './pushService.ts';

/** Standard closing line used on every user-facing TopHand notification. */
export const TOPHAND_SIGNATURE = 'Hurmat bilan, TopHand jamoasi 🧡';

/**
 * Append the TopHand footer unless the body already carries it.
 * Keeps announcements (holidays / events / milestones) consistently signed.
 */
export function signTopHand(body: string): string {
  const text = (body || '').trim();
  if (text.toLowerCase().includes('hurmat bilan')) return text;
  return `${text}\n\n${TOPHAND_SIGNATURE}`;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  /** Set false to send the body verbatim (no auto signature). Default: signed. */
  signed?: boolean;
}

/** Persist a single in-app notification (fire-and-forget safe). */
export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const id = `notif_${crypto.randomUUID().slice(0, 16)}`;
  const now = new Date().toISOString();
  const body = input.signed === false ? input.body : signTopHand(input.body);
  await runQuery(
    `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, input.type, input.title, body, input.link ?? null, now]
  );

  // Mirror the notification as a Web Push so it is seen even when the tab/site is closed.
  // Uses the unsigned body (shorter) and is fully fire-and-forget.
  sendPushToUser(input.userId, {
    title: input.title,
    body: (input.body || '').trim(),
    url: input.link || '/notifications',
    tag: input.type,
  }).catch(() => {});

  return id;
}

/** Welcome message sent right after a brand-new account is created. */
export async function notifyWelcome(userId: string, name?: string) {
  const greeting = name && name.trim() ? `Assalomu alaykum, ${name.trim()}!` : 'Assalomu alaykum!';
  await createNotification({
    userId,
    type: 'WELCOME',
    title: 'TopHand’ga xush kelibsiz! 👋',
    body:
      `${greeting} Bizga qo'shilganingizdan mamnunmiz. Endi o'z xizmatlaringizni joylashing, ` +
      `ish toping va mahalliy ustalar bilan bevosita bog'laning. ` +
      `Profilingizni to'ldirsangiz — ishonch va ko'rinishiniz ortadi.\n\n` +
      `Savol yoki yordam kerak bo'lsa, TopHand jamoasi doimo hamrohingiz.`,
    link: '/profile',
  });
}

/** Debut milestone: the user published their very first listing. */
export async function notifyFirstListing(userId: string, listingTitle: string) {
  await createNotification({
    userId,
    type: 'MILESTONE',
    title: 'Birinchi e’loningiz joylandi! 🎉',
    body:
      `Tabriklaymiz! "${listingTitle}" — bu sizning TopHand’dagi debyut e’loningiz. ` +
      `Uni ko'proq odamga yetkazish uchun do'stlaringiz bilan baham ko'ring va kelib tushadigan ` +
      `so'rovlarga o'z vaqtida javob bering. Omad tilaymiz!`,
    link: '/profile',
  });
}
