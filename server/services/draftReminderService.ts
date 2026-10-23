import { queryAll } from '../db/database.ts';
import { createNotification } from './notificationService.ts';

// Qoralama (DRAFT) eslatmasi: foydalanuvchi qoralamalarni tozalamasa, har
// REMINDER_DAYS kunda bir marta eslab turiladi. Cron chastotasi (INTERVAL) shu
// 2 kunlik derazadan ko'ra tez-tez ishlaydi; per-user «2 kun» cheklovi quyidagi
// so'rovda (NOT IN … created_at >= lastSent) ta'minlanadi — shu bilan har bir
// egaga 2 kunda eng ko'pi bilan 1 eslatma boradi.
const REMINDER_DAYS = 2;
// Qoralama tug'ilganiga kamida MIN_AGE_HOURS o'tsa eslatiladi (yangi qoralama
// darhol nag'lanmaydi).
const MIN_AGE_HOURS = 24;
// Cron tekshiruvi har 6 soatda (2 kunlik cheklov alohida saqlanadi).
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function processDraftReminders() {
  const olderThan = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const lastSent = new Date(Date.now() - REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Har bir egasi uchun BITTASI consolidated eslatma; so'nggi 2 kunda eslatma
  // olgan egalar chiqarib tashlanadi.
  const rows = await queryAll<{ owner_user_id: string; draft_count: number | string }>(
    `SELECT owner_user_id, COUNT(*) AS draft_count
     FROM listings
     WHERE status = 'DRAFT' AND created_at <= ?
       AND owner_user_id NOT IN (
         SELECT user_id FROM notifications
         WHERE type = 'DRAFT_REMINDER' AND created_at >= ?
       )
     GROUP BY owner_user_id`,
    [olderThan, lastSent]
  );

  for (const r of rows) {
    const count = Number(r.draft_count);
    await createNotification({
      userId: r.owner_user_id,
      type: 'DRAFT_REMINDER',
      title: 'Qoralamalaringiz sizni kutmoqda ✍️',
      body:
        `Sizda ${count} ta yakunlanmagan qoralama bor. Istasangiz davom ettirib joylang, ` +
        `kerak bo'lmasa «Qoralamalar» bo'limidan o'chirib tashlang.`,
      link: '/profile',
    }).catch(() => {});
  }

  return { reminded_count: rows.length };
}

export function startDraftReminderCron() {
  // Ishga tushishda bir marta
  processDraftReminders().catch((err) =>
    console.error('Error running initial draft reminder job:', err)
  );

  // Har 6 soatda tekshiriladi
  setInterval(() => {
    processDraftReminders().catch((err) =>
      console.error('Error running periodic draft reminder job:', err)
    );
  }, CHECK_INTERVAL_MS);
}
