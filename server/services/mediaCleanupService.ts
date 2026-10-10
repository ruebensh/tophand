import { queryAll, runQuery } from '../db/database.ts';
import { attemptDeleteStoredMedia } from './storageService.ts';
import {
  listDueDeletions,
  recordFailedAttempt,
  removeDeletion,
} from './mediaDeletionQueue.ts';

/**
 * Media cleanup (report #6/#7/#10).
 *
 * Three responsibilities, run on a periodic cron:
 *  1. DRAIN the durable retry queue — re-attempt media deletes that failed
 *     transiently, with backoff, until they succeed (never leak an object).
 *  2. RECLAIM ORPHAN uploads — every generic upload (/api/upload) is recorded in
 *     `media_uploads`. Files never bound to any live DB record after a TTL are
 *     deleted. In-use files are stamped `bound_at` and never touched again.
 *  3. RECLAIM ABANDONED verification uploads — passport/selfie images uploaded
 *     but never submitted (not the owner's current application) past a TTL.
 *
 * SAFETY: deletion targets ONLY our storage shapes (external/bundled refs are
 * skipped inside attemptDeleteStoredMedia) and never touches a file still
 * referenced anywhere in the DB. On delete failure the row is kept / requeued.
 */

function ttlHours(envName: string, fallback: number): number {
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw >= 1 ? raw : fallback;
}

// `folder/file` → `file`; a URL → last path segment (query/hash stripped).
export function basenameOf(ref: string): string {
  const clean = String(ref || '').split('?')[0].split('#')[0];
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

/** Record a generic upload so it can be reclaimed if never bound. Best-effort. */
export async function recordUpload(u: { key: string; url: string; storage: string }): Promise<void> {
  if (!u?.key || !u?.url) return;
  try {
    await runQuery(
      `INSERT INTO media_uploads (key, url, storage, created_at)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT(key) DO NOTHING`,
      [u.key, u.url, u.storage]
    );
  } catch (err: any) {
    console.warn('recordUpload xato (sweep uchun preview):', err?.message || err);
  }
}

// Every URL-bearing column a generic upload can end up in. If a basename appears
// here it is "in use" → never reclaimed.
async function collectReferencedBasenames(): Promise<Set<string>> {
  const rows = await queryAll<{ ref: string }>(
    `SELECT ref FROM (
       SELECT profile_photo_url AS ref FROM users WHERE profile_photo_url IS NOT NULL
       UNION ALL SELECT cover_photo_url FROM users WHERE cover_photo_url IS NOT NULL
       UNION ALL SELECT verification_photo_url FROM users WHERE verification_photo_url IS NOT NULL
       UNION ALL SELECT url FROM listing_images WHERE url IS NOT NULL
       UNION ALL SELECT attachment_url FROM messages WHERE attachment_url IS NOT NULL
       UNION ALL SELECT image_url FROM ads WHERE image_url IS NOT NULL
       UNION ALL SELECT video_url FROM ads WHERE video_url IS NOT NULL
       UNION ALL SELECT logo_url FROM organizations WHERE logo_url IS NOT NULL
       UNION ALL SELECT value FROM system_settings WHERE value IS NOT NULL
     ) t`
  );
  const set = new Set<string>();
  for (const r of rows) {
    if (r?.ref) set.add(basenameOf(r.ref));
  }
  return set;
}

async function drainRetryQueue(): Promise<number> {
  const due = await listDueDeletions(200);
  let done = 0;
  for (const row of due) {
    const res = await attemptDeleteStoredMedia(row.ref);
    if (res.ok || res.skipped) {
      // success OR no longer ours (already gone / external) → drop from queue
      await removeDeletion(row.ref);
      done++;
    } else {
      await recordFailedAttempt(row.ref, row.attempts + 1, res.error || 'unknown');
    }
  }
  return done;
}

async function reclaimOrphanUploads(referenced: Set<string>): Promise<number> {
  const hours = ttlHours('MEDIA_ORPHAN_TTL_HOURS', 24);
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const candidates = await queryAll<{ key: string; url: string }>(
    `SELECT key, url FROM media_uploads
     WHERE bound_at IS NULL AND created_at <= ?
     ORDER BY created_at ASC
     LIMIT 500`,
    [cutoff]
  );
  let reclaimed = 0;
  for (const c of candidates) {
    const base = basenameOf(c.key);
    if (referenced.has(base)) {
      // In use by a live record → stamp bound so we stop rescanning it.
      await runQuery('UPDATE media_uploads SET bound_at = NOW() WHERE key = ?', [c.key]);
      continue;
    }
    const res = await attemptDeleteStoredMedia(c.url);
    if (res.ok || res.skipped) {
      await runQuery('DELETE FROM media_uploads WHERE key = ?', [c.key]);
      reclaimed++;
    }
    // genuine failure → leave the row; retried next cycle (still old + unbound)
  }
  return reclaimed;
}

async function reclaimAbandonedVerification(): Promise<number> {
  const hours = ttlHours('VERIFICATION_ABANDONED_TTL_HOURS', 24);
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  // Any verification_uploads row NOT currently bound to its owner's application
  // (i.e. abandoned previews) and past TTL. PENDING-bound uploads are excluded.
  const rows = await queryAll<{ id: string; object_key: string }>(
    `SELECT id, object_key FROM verification_uploads
     WHERE created_at <= ?
       AND id NOT IN (
         SELECT verification_upload_id FROM users WHERE verification_upload_id IS NOT NULL
       )
     ORDER BY created_at ASC
     LIMIT 500`,
    [cutoff]
  );
  let reclaimed = 0;
  for (const r of rows) {
    const res = await attemptDeleteStoredMedia(r.object_key);
    if (res.ok || res.skipped) {
      await runQuery('DELETE FROM verification_uploads WHERE id = ?', [r.id]);
      reclaimed++;
    }
  }
  return reclaimed;
}

export async function processMediaCleanup(): Promise<{
  retried: number;
  reclaimed_uploads: number;
  reclaimed_verifications: number;
}> {
  const retried = await drainRetryQueue();
  const referenced = await collectReferencedBasenames();
  const reclaimed_uploads = await reclaimOrphanUploads(referenced);
  const reclaimed_verifications = await reclaimAbandonedVerification();
  return { retried, reclaimed_uploads, reclaimed_verifications };
}

export function startMediaCleanupCron(): void {
  const run = () =>
    processMediaCleanup().catch((err) =>
      console.error('Media cleanup job xato:', err)
    );
  // Delay first run a little so startup/seed finishes; then every 30 minutes.
  setTimeout(run, 60 * 1000);
  setInterval(run, 30 * 60 * 1000);
}
