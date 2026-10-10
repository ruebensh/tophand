import { runQuery, queryAll } from '../db/database.ts';

/**
 * media_deletions — DURABLE RETRY QUEUE (report #6/#10).
 *
 * A media-file delete can fail transiently (R2 network blip, IAM lag). If we only
 * logged a warning the object would leak forever. Instead `deleteStoredMedia`
 * enqueues the failed reference here and the cleanup cron (`mediaCleanupService`)
 * retries it with backoff until it succeeds.
 *
 * IMPORTANT: this module imports ONLY the database layer, never storageService,
 * so storageService can import it without creating a circular dependency.
 */

// Backoff ladder (ms): 15m, 1h, 6h, 24h, then keep at 24h.
const BACKOFF_MS = [
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

// Report (dq): bir ref uchunmaksimal urinishlar soni. Shundan keyin qator
// dead-letter belgilanadi — abadiy buziq ('poison') obyekt queue'ni cheksiz
// shovullamaydi. (Obyekt baribir leak bo'lishi mumkin, lekin u endi operatorga
// ko'rinadigan alohida holatda qoladi; quyida `listDeadLetters` bilan tekshiriladi.)
const MAX_ATTEMPTS = 12;

function nextDelayMs(attempts: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempts - 1, 0), BACKOFF_MS.length - 1)];
}

/**
 * Record (or bump) a failed delete for retry. Deduped by `ref` so repeated
 * failures of the same object don't pile up rows.
 */
export async function enqueueDeletion(ref: string, error?: string): Promise<void> {
  if (!ref) return;
  const safeRef = String(ref).slice(0, 2000);
  const safeErr = String(error || '').slice(0, 500);
  try {
    await runQuery(
      `INSERT INTO media_deletions (ref, attempts, last_error, created_at, next_attempt_at)
       VALUES (?, 1, ?, NOW(), NOW() + (? || ' milliseconds')::interval)
       ON CONFLICT(ref) DO UPDATE SET
         attempts = media_deletions.attempts + 1,
         last_error = excluded.last_error,
         dead_lettered_at = NULL,
         next_attempt_at = GREATEST(media_deletions.next_attempt_at, NOW() + (? || ' milliseconds')::interval)`,
      // Report (dq): backoff-reset fix. Oldcode `next_attempt_at = NOW()+15m`
      // edi — ya'ni drain-cron allaqachon 24h'ga ko'targan escalation'ni yangi
      // enqueue yana 15m'ga tushirib, escalation'ni bekor qilardi (buziq obyekt
      // har 15 daqiqada qayta-qayta urinishga tushardi). `GREATEST` mavjud
      // (escalated) jadvalni SAQLAYDI, faqat u allaqachon o'tib ketgan bo'lsa
      // minimal birinichi kechikishni beradi.
      [safeRef, safeErr, String(BACKOFF_MS[0]), String(BACKOFF_MS[0])]
    );
  } catch (err: any) {
    // Best-effort: even the queue write can fail (DB down). Never throw to caller.
    console.warn('enqueueDeletion xato:', err?.message || err);
  }
}

/** Due-for-retry rows (next_attempt_at <= now), oldest first, capped.
 *  Report (dq): dead-letterlangan qatorlar ENDI ajratilmaydi — ular operator
 *  tomonidan qo'lda ko'rib chiqilishi uchun `dead_lettered_at` belgili qoladi. */
export async function listDueDeletions(limit = 200): Promise<Array<{ ref: string; attempts: number }>> {
  return queryAll<{ ref: string; attempts: number }>(
    `SELECT ref, attempts FROM media_deletions
     WHERE next_attempt_at <= NOW() AND dead_lettered_at IS NULL
     ORDER BY next_attempt_at ASC
     LIMIT ${Math.max(1, Math.min(limit, 1000))}`
  );
}

/**
 * Update a row after a failed retry attempt (increment + backoff).
 * Report (dq): `attempts` MAX_ATTEMPTS'tan oshsa qator dead-letter belgilanadi
 * (retry skedjulidan chiqadi), aks holda keyingi kechikish bilan re-scheduled.
 */
export async function recordFailedAttempt(ref: string, attempts: number, error: string): Promise<void> {
  const delay = nextDelayMs(attempts);
  const dead = attempts >= MAX_ATTEMPTS;
  if (dead) {
    console.warn(
      `mediaDeletionQueue: "${String(ref).slice(0, 120)}" ${attempts} marta o'chirilmadi — DEAD-LETTER (qo'lda tekshirish kerak).`
    );
  }
  await runQuery(
    `UPDATE media_deletions
     SET attempts = ?, last_error = ?,
         dead_lettered_at = CASE WHEN ? THEN NOW() ELSE dead_lettered_at END,
         next_attempt_at = NOW() + (? || ' milliseconds')::interval
     WHERE ref = ?`,
    [attempts, String(error || '').slice(0, 500), dead, String(delay), ref]
  );
}

/** Dead-letterlangan (tashkilan) qatorlar — operator ko'rigi uchun. */
export async function listDeadLetters(limit = 100): Promise<Array<{ ref: string; attempts: number; last_error: string | null }>> {
  return queryAll<{ ref: string; attempts: number; last_error: string | null }>(
    `SELECT ref, attempts, last_error FROM media_deletions
     WHERE dead_lettered_at IS NOT NULL
     ORDER BY dead_lettered_at DESC
     LIMIT ${Math.max(1, Math.min(limit, 500))}`
  );
}

/** Jami dead-letter qatorlari soni (cron log'/monitoring uchun, arzon). */
export async function countDeadLetters(): Promise<number> {
  const rows = await queryAll<{ n: number | string }>(
    `SELECT COUNT(*)::int AS n FROM media_deletions WHERE dead_lettered_at IS NOT NULL`
  );
  return Number(rows[0]?.n ?? 0);
}

/** Delete succeeded → remove from queue. */
export async function removeDeletion(ref: string): Promise<void> {
  await runQuery('DELETE FROM media_deletions WHERE ref = ?', [ref]);
}
