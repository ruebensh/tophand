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
         next_attempt_at = NOW() + (? || ' milliseconds')::interval`,
      [safeRef, safeErr, String(BACKOFF_MS[0]), String(BACKOFF_MS[0])]
    );
  } catch (err: any) {
    // Best-effort: even the queue write can fail (DB down). Never throw to caller.
    console.warn('enqueueDeletion xato:', err?.message || err);
  }
}

/** Due-for-retry rows (next_attempt_at <= now), oldest first, capped. */
export async function listDueDeletions(limit = 200): Promise<Array<{ ref: string; attempts: number }>> {
  return queryAll<{ ref: string; attempts: number }>(
    `SELECT ref, attempts FROM media_deletions
     WHERE next_attempt_at <= NOW()
     ORDER BY next_attempt_at ASC
     LIMIT ${Math.max(1, Math.min(limit, 1000))}`
  );
}

/** Update a row after a failed retry attempt (increment + backoff). */
export async function recordFailedAttempt(ref: string, attempts: number, error: string): Promise<void> {
  const delay = nextDelayMs(attempts);
  await runQuery(
    `UPDATE media_deletions
     SET attempts = ?, last_error = ?, next_attempt_at = NOW() + (? || ' milliseconds')::interval
     WHERE ref = ?`,
    [attempts, String(error || '').slice(0, 500), String(delay), ref]
  );
}

/** Delete succeeded → remove from queue. */
export async function removeDeletion(ref: string): Promise<void> {
  await runQuery('DELETE FROM media_deletions WHERE ref = ?', [ref]);
}
