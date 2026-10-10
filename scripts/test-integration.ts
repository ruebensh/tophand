// ─── API integration suite (commit-62 report, PR-4) ──────────────────────────
// REAL Express middleware chain + REAL PostgreSQL — booted on an ephemeral port
// and driven over HTTP with global fetch. Covers the six areas the report asks
// for beyond the pure helper tests:
//   • file upload (F-06 reserved folder + real Sharp pipeline → local disk)
//   • file ownership check + signed image view (H-07 / P1-2, verifyMediaRoutes)
//   • request-count rate limiting (F-01 code-bucket + F-02 send-code cooldown)
//   • registration identical response / no enumeration (F-08)
//   • generic 5xx error body, no internal leak (F-10)
// Run: `npm run test:integration` (also part of `npm test`). Requires a reachable
// Postgres (CI provides one as a service container).
//
// Hermetic env: LOCAL_DEV=1 keeps fail-closed exposed gates from blocking the
// suite, R2 + email providers are cleared so uploads land on local disk and no
// real network egress happens, and TRUST_PROXY=0 matches the direct socket the
// tests use (so a forged X-Forwarded-For cannot change req.ip / reset buckets).
process.env.LOCAL_DEV = '1';
process.env.NODE_ENV = 'test';
process.env.TRUST_PROXY = '0';
process.env.JWT_SECRET = 'integration-test-secret-0123456789abcdef';
for (const k of [
  'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET_NAME',
  'R2_PUBLIC_URL', 'R2_PRIVATE_BUCKET_NAME', 'R2_ACCOUNT_ID',
  'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER',
  'SMTP_PASS', 'SMTP_FROM', 'ADMIN_EMAIL',
]) process.env[k] = '';

// SAFETY (critical): integration tests must NEVER touch a real/remote database.
// `.env` may point at production (e.g. a hosted Neon URL) — importing server.ts
// runs `dotenv/config`, so we FORCE a local/CI Postgres here and pre-set
// DATABASE_URL (dotenv cannot overwrite an already-set key). A non-local target
// is refused unless the operator explicitly exports TEST_DATABASE_URL or we are
// running in CI.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://tophand:tophand123@127.0.0.1:5432/tophand';
const isLocalTarget = /(127\.0\.0\.1|localhost|::1)/.test(TEST_DB_URL);
if (!isLocalTarget && !process.env.CI) {
  console.error(
    'REFUSED: integration tests will not run against a non-local DB. ' +
      'Set TEST_DATABASE_URL to a throwaway/local Postgres. Target was:\n  ' +
      TEST_DB_URL.replace(/:[^:@/]*@/, ':***@')
  );
  process.exit(1);
}
process.env.DATABASE_URL = TEST_DB_URL;

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

let passed = 0;
let failed = 0;
function assert(cond: boolean, name: string) {
  if (cond) { passed++; console.log(`  [PASS] ${name}`); }
  else { failed++; console.error(`  [FAIL] ${name}`); }
}
const RUN_ID = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

async function main() {
  console.log('=== TOPHAND API INTEGRATION TESTS ===');

  // Load the REAL app AFTER env is set (module graph captures JWT_SECRET, pool,
  // storage config at import time). Importing server.ts does NOT auto-listen
  // (guarded by its own main-module check).
  const { app } = await import('../server.ts');
  const { initDatabase } = await import('../server/db/init.ts');
  const { pool, runQuery, queryOne } = await import('../server/db/database.ts');
  const { generateToken } = await import('../server/auth/telegram.ts');
  const { signVerificationPhotoUrl } = await import('../server/lib/signedUrl.ts');
  const { processMediaCleanup } = await import('../server/services/mediaCleanupService.ts');
  const { enqueueDeletion } = await import('../server/services/mediaDeletionQueue.ts');

  await initDatabase();

  const srv = http.createServer(app);
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const port = (srv.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const req = (p: string, init?: RequestInit) => fetch(base + p, init);

  // A real, decodable JPEG (Sharp round-trip) for the upload happy-path.
  const realJpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#3b82f6' } })
    .jpeg({ quality: 80 })
    .toBuffer();

  // ── Test users ────────────────────────────────────────────────────────────
  const mkUser = async (id: string, email: string, role = 'USER') => {
    await runQuery(
      `INSERT INTO users (id, email, name, role, is_banned, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, NOW(), NOW())`,
      [id, email, 'Integration Tester', role]
    );
    return { id, email, role };
  };
  const alice = await mkUser(`usr_integ_alice_${RUN_ID}`, `alice_${RUN_ID}@integ.example`);
  const bob = await mkUser(`usr_integ_bob_${RUN_ID}`, `bob_${RUN_ID}@integ.example`);
  const aliceToken = generateToken(alice);
  const authJson = (body: any, token?: string): RequestInit => ({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  // Cleanup registry (best-effort; FK order matters). We track ONLY the exact
  // files this run created — never wipe whole upload dirs (dev has real media).
  const cleanupObjects: string[] = [];

  try {
    // ── 1) F-06: reserved `verifications` folder is rejected at the route ────
    {
      const fd = new FormData();
      fd.append('image', new Blob([realJpeg], { type: 'image/jpeg' }), 'a.jpg');
      for (const bad of ['VERIFICATIONS', 'Verifications', 'verifications/']) {
        const r = await req(`/api/upload?folder=${encodeURIComponent(bad)}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
          body: fd,
        });
        assert(r.status === 400, `upload: folder "${bad}" rejected at route (F-06)`);
      }
    }

    // ── 2) Real upload pipeline → 200 + local-disk URL (R2 disabled) ────────
    {
      const fd = new FormData();
      fd.append('image', new Blob([realJpeg], { type: 'image/jpeg' }), 'listing.jpg');
      const r = await req('/api/upload?folder=listings', {
        method: 'POST',
        headers: { authorization: `Bearer ${aliceToken}` },
        body: fd,
      });
      const j: any = r.status === 200 ? await r.json().catch(() => ({})) : {};
      if (typeof j.filename === 'string') cleanupObjects.push(path.resolve(process.cwd(), 'uploads', j.filename));
      assert(
        r.status === 200 && typeof j.url === 'string' && j.url.startsWith('/uploads/listings/') && j.storage === 'local',
        'upload: valid image stored on local disk and returns same-origin URL'
      );

      // A file that PASSES the multer MIME allowlist but has no real raster
      // magic must be rejected (400) by the authoritative magic-byte gate, i.e.
      // Sharp is never fed garbage. (SVG is already blocked even earlier by MIME.)
      const fd2 = new FormData();
      fd2.append('image', new Blob([Buffer.from('this is definitely not a png')], { type: 'image/png' }), 'fake.png');
      const r2 = await req('/api/upload?folder=listings', {
        method: 'POST',
        headers: { authorization: `Bearer ${aliceToken}` },
        body: fd2,
      });
      assert(r2.status === 400, 'upload: declared-PNG/garbage rejected by magic-byte gate (400)');
    }

    // ── 3) Signed verification image: fail-closed + ownership re-check ──────
    {
      const docFile = `integ-alice-${RUN_ID}.webp`;
      const objectKey = `verifications/${docFile}`;
      const verifyDir = path.resolve(process.cwd(), 'uploads/verifications');
      fs.mkdirSync(verifyDir, { recursive: true });
      const localDoc = path.join(verifyDir, docFile);
      cleanupObjects.push(localDoc);

      // 3a. No signature at all → 403 (fail closed).
      const noSig = await req(`/api/verification-photo/${docFile}`);
      assert(noSig.status === 403, 'signed-photo: no signature → 403');

      // 3b. Valid signature (owner=alice) but NO ownership DB row yet → 403.
      const urlNoRow = signVerificationPhotoUrl(docFile, alice.id)!;
      const denied = await req(urlNoRow);
      assert(denied.status === 403, 'signed-photo: valid sig but no ownership row → 403');

      // Bind the object to alice and drop a real (re-encoded) file on disk.
      const webp = await sharp(realJpeg).webp({ quality: 70 }).toBuffer();
      fs.writeFileSync(localDoc, webp);
      await runQuery(
        `INSERT INTO verification_uploads (id, owner_user_id, purpose, object_key, media_type, created_at)
         VALUES (?, ?, 'verification', ?, 'image/webp', NOW())`,
        [`vu_${RUN_ID}`, alice.id, objectKey]
      );

      // 3c. Owner + valid sig + existing row + local object → 200 image/webp.
      const ok = await req(urlNoRow);
      const ct = ok.headers.get('content-type') || '';
      assert(ok.status === 200 && ct.startsWith('image/webp'), 'signed-photo: owner + valid sig → 200 image');
      assert((ok.headers.get('cache-control') || '').includes('no-store'), 'signed-photo: private no-store cache header');

      // 3d. Tampered owner (signed for alice, requested as bob) → sig fails → 403.
      const tampered = urlNoRow.replace(`uid=${encodeURIComponent(alice.id)}`, `uid=${encodeURIComponent(bob.id)}`);
      const denied2 = await req(tampered);
      assert(denied2.status === 403, 'signed-photo: tampered owner uid rejected (HMAC binds owner)');

      // 3e. Expired link rejected (mint with negative TTL).
      const expired = signVerificationPhotoUrl(docFile, alice.id, -10)!;
      const denied3 = await req(expired);
      assert(denied3.status === 403, 'signed-photo: expired link rejected');
    }

    // ── 4) Public proxies must never expose verifications/* ─────────────────
    {
      // /api/storage/verifications/<file> proxy path → 404 regardless of R2.
      const pub = await req(`/api/storage/verifications/whatever-${RUN_ID}.webp`);
      assert(pub.status === 404, 'storage proxy: verifications/* not publicly reachable (404)');
      // Static /uploads/verifications is hard-blocked to 404.
      const stat = await req(`/uploads/verifications/whatever-${RUN_ID}.webp`);
      assert(stat.status === 404, 'static: /uploads/verifications blocked (404)');
    }

    // ── 5) F-01/F-02: rate limiting enforced end-to-end ─────────────────────
    {
      // 5a. register/send-code is capped at 10/hour per identity. We vary the
      // Authorization header on EVERY request — with the fixed (identity-only)
      // bucket key this must NOT reset the counter, so the 11th is 429.
      let got429 = false;
      let lastBody = '';
      for (let i = 0; i < 12; i++) {
        const r = await req('/api/auth/register/send-code', {
          ...authJson({ email: `rl_${RUN_ID}@integ.example` }),
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer rotate-${i}-${crypto.randomBytes(4).toString('hex')}`,
          },
        });
        if (r.status === 429) { got429 = true; lastBody = await r.text().catch(() => ''); break; }
      }
      assert(got429, 'limit: 11th+ code-send within window → 429 despite rotating bearer (F-01)');
      assert(!/rotate-|bearer/i.test(lastBody), 'limit: 429 body does not echo client header');

      // 5b. F-02 send-code cooldown: same authenticated identity + same target
      // email twice inside 30s → second is 429 (dedicated stricter limiter).
      const targetEmail = `link_${RUN_ID}@integ.example`;
      const first = await req('/api/auth/email/send-code', authJson({ email: targetEmail }, aliceToken));
      const second = await req('/api/auth/email/send-code', authJson({ email: targetEmail }, aliceToken));
      assert(second.status === 429, 'limit: 2nd send-code within 30s cooldown → 429 (F-02)');
      void first;
    }

    // ── 6) F-08: registration response is identical for existing vs new email ─
    {
      // Invalid OTP is checked BEFORE any existence lookup, so the reply must be
      // byte-identical whether or not the account exists (no enumeration).
      const existing = await req('/api/auth/register', authJson({ email: alice.email, code: '000000', password: 'hunter2!' }));
      const fresh = await req('/api/auth/register', authJson({ email: `nobody_${RUN_ID}@integ.example`, code: '000000', password: 'hunter2!' }));
      const existingBody = await existing.text();
      const freshBody = await fresh.text();
      assert(existing.status === fresh.status, 'register: same status for existing vs unknown email (F-08)');
      assert(existingBody === freshBody, 'register: same body for existing vs unknown email (F-08)');
      assert(!/existing|registered|allready|mavjud/i.test(existingBody), 'register: body does not reveal account existence');
    }

    // ── 7) LOWER(email) DB uniqueness actually enforced (F-08 constraint) ────
    {
      let blocked = false;
      try {
        await runQuery(
          `INSERT INTO users (id, email, name, role, is_banned, created_at, updated_at)
           VALUES (?, ?, 'Case Dup', 'USER', 0, NOW(), NOW())`,
          [`usr_integ_dup_${RUN_ID}`, `ALICE_${RUN_ID}@integ.example`] // different CASE, same LOWER
        );
      } catch (e: any) {
        blocked = e?.code === '23505' || /unique|duplicate|users_email_lower/i.test(String(e?.message || ''));
      }
      assert(blocked, 'db: LOWER(email) unique index rejects case-variant duplicate (F-08)');
    }

    // ── 8) F-10: a genuine 5xx returns a generic body (no internal leak) ────
    {
      // >15MB upload trips multer's LIMIT_FILE_SIZE, which is thrown from
      // middleware (not the route try/catch) and lands in the central /api error
      // handler → 500. The internal message must NOT be exposed.
      const big = Buffer.alloc(16 * 1024 * 1024 + 1024, 1);
      const fd = new FormData();
      fd.append('image', new Blob([big], { type: 'image/jpeg' }), 'big.jpg');
      const r = await req('/api/upload?folder=listings', {
        method: 'POST',
        headers: { authorization: `Bearer ${aliceToken}` },
        body: fd,
      });
      const j: any = await r.json().catch(() => ({}));
      assert(r.status === 500, 'err: oversized upload surfaces a 5xx (real pipeline)');
      assert(j.error === 'Serverda ichki xatolik yuz berdi', 'err: 5xx body is the generic message (F-10)');
      const raw = JSON.stringify(j).toLowerCase();
      assert(!/stack|multer|file too large|limit_file|at .*\.ts:/.test(raw), 'err: 5xx body leaks no internals (F-10)');
    }

    // ── 9) Media cleanup cron (report #6/#7/#10) ─────────────────────────────
    {
      const dir = path.resolve(process.cwd(), 'uploads', 'listings');
      fs.mkdirSync(dir, { recursive: true });
      const backdate = `NOW() - INTERVAL '26 hours'`;
      const writeMedia = (name: string) => {
        const p = path.join(dir, name);
        fs.writeFileSync(p, Buffer.from('RIFFFAKEWEBPDATA'));
        return p;
      };

      // (a) ORPHAN: manifest row, no DB reference, past TTL → reclaimed.
      const orphanName = `integ_orphan_${RUN_ID}.webp`;
      const orphanKey = `listings/${orphanName}`;
      writeMedia(orphanName);
      await runQuery(
        `INSERT INTO media_uploads (key, url, storage, created_at) VALUES (?, ?, 'local', ${backdate})`,
        [orphanKey, `/uploads/${orphanKey}`]
      );

      // (b) BOUND: same shape but referenced by a live column (alice profile).
      const boundName = `integ_bound_${RUN_ID}.webp`;
      const boundKey = `listings/${boundName}`;
      const boundPath = writeMedia(boundName);
      cleanupObjects.push(boundPath);
      await runQuery(
        `INSERT INTO media_uploads (key, url, storage, created_at) VALUES (?, ?, 'local', ${backdate})`,
        [boundKey, `/uploads/${boundKey}`]
      );
      await runQuery('UPDATE users SET profile_photo_url = ? WHERE id = ?', [`/uploads/${boundKey}`, alice.id]);

      // (c) RETRY: an enqueued failed deletion is drained (file removed, row gone).
      const retryName = `integ_retry_${RUN_ID}.webp`;
      writeMedia(retryName);
      await enqueueDeletion(`/uploads/listings/${retryName}`, 'simulated transient failure');
      // enqueue sets a 15m backoff for the NEXT attempt; force it due now for the test.
      await runQuery(
        `UPDATE media_deletions SET next_attempt_at = NOW() - INTERVAL '1 minute' WHERE ref = ?`,
        [`/uploads/listings/${retryName}`]
      );

      const res = await processMediaCleanup();

      assert(!fs.existsSync(path.join(dir, orphanName)), 'cleanup: orphan upload past TTL is deleted (report #7)');
      const orphanGone = await queryOne('SELECT key FROM media_uploads WHERE key = ?', [orphanKey]);
      assert(!orphanGone, 'cleanup: orphan manifest row removed after reclaim (report #7)');

      assert(fs.existsSync(boundPath), 'cleanup: in-use (referenced) file is NOT deleted (report #6)');
      const boundRow = await queryOne<{ bound_at: string | null }>('SELECT bound_at FROM media_uploads WHERE key = ?', [boundKey]);
      assert(!!boundRow?.bound_at, 'cleanup: referenced upload stamped bound_at (report #7)');

      assert(!fs.existsSync(path.join(dir, retryName)), 'cleanup: retry queue drains failed delete (report #10)');
      const retryRow = await queryOne('SELECT ref FROM media_deletions WHERE ref = ?', [`/uploads/listings/${retryName}`]);
      assert(!retryRow, 'cleanup: retry row removed on success (report #10)');
      assert(res && typeof res.reclaimed_uploads === 'number', 'cleanup: processMediaCleanup returns counters');

      // restore + tidy
      await runQuery('UPDATE users SET profile_photo_url = NULL WHERE id = ?', [alice.id]);
      await runQuery('DELETE FROM media_uploads WHERE key = ?', [boundKey]);
    }

    // ── 10) Verification CANCEL endpoint (report #4) ───────────────────
    {
      const vdir = path.resolve(process.cwd(), 'uploads', 'verifications');
      fs.mkdirSync(vdir, { recursive: true });
      const vfile = `integ_cancel_${RUN_ID}.webp`;
      const vpath = path.join(vdir, vfile);
      fs.writeFileSync(vpath, Buffer.from('RIFFFAKEWEBPDATA'));
      cleanupObjects.push(vpath);
      const vupId = `vup_integ_${RUN_ID}`;
      await runQuery(
        `INSERT INTO verification_uploads (id, owner_user_id, purpose, object_key, media_type, created_at)
         VALUES (?, ?, 'verification', ?, 'image/webp', NOW())`,
        [vupId, alice.id, `verifications/${vfile}`]
      );
      await runQuery(
        `UPDATE users SET verification_status = 'PENDING', verification_upload_id = ?, verification_photo_url = ? WHERE id = ?`,
        [vupId, `verifications/${vfile}`, alice.id]
      );

      const r = await req('/api/users/me/verification/cancel', {
        method: 'POST',
        headers: { authorization: `Bearer ${aliceToken}` },
      });
      const j: any = await r.json().catch(() => ({}));
      assert(r.status === 200, 'cancel: 200 for own PENDING application (report #4)');
      assert(j?.user?.verification_status === 'UNVERIFIED', 'cancel: status set to UNVERIFIED (report #4)');
      assert(!fs.existsSync(vpath), 'cancel: verification IMAGE file deleted (legal, report #4)');
      const row = await queryOne('SELECT id FROM verification_uploads WHERE id = ?', [vupId]);
      assert(!row, 'cancel: verification_uploads row removed (report #4)');
      const u = await queryOne<any>('SELECT verification_photo_url, verification_upload_id, full_legal_name FROM users WHERE id = ?', [alice.id]);
      assert(u?.verification_photo_url === null && u?.verification_upload_id === null, 'cancel: photo refs nulled (report #4)');

      // Non-PENDING cancel must be rejected (idempotent guard).
      const r2 = await req('/api/users/me/verification/cancel', {
        method: 'POST',
        headers: { authorization: `Bearer ${aliceToken}` },
      });
      assert(r2.status === 400, 'cancel: rejected when not PENDING (400)');
    }

    // ── 11) Chief moderator (LEAD_MOD): role-gate + scoped stats ────────────
    {
      const admin = await mkUser(`usr_integ_admin_${RUN_ID}`, `admin_${RUN_ID}@integ.example`, 'ADMIN');
      const lead = await mkUser(`usr_integ_lead_${RUN_ID}`, `lead_${RUN_ID}@integ.example`, 'LEAD_MOD');
      const mod = await mkUser(`usr_integ_mod_${RUN_ID}`, `mod_${RUN_ID}@integ.example`, 'MODERATOR');
      const plain = await mkUser(`usr_integ_plain_${RUN_ID}`, `plain_${RUN_ID}@integ.example`, 'USER');
      const leadToken = generateToken(lead);
      const adminToken = generateToken(admin);
      const userToken = generateToken(plain);
      const hdr = (tk: string) => ({ authorization: `Bearer ${tk}` });

      // LEAD reads scoped stats (mine + team).
      const sm = await req('/api/lead/stats/mine', { headers: hdr(leadToken) });
      assert(sm.status === 200, 'lead: GET /api/lead/stats/mine → 200');
      const st = await req('/api/lead/stats/team', { headers: hdr(leadToken) });
      assert(st.status === 200, 'lead: GET /api/lead/stats/team → 200');

      // LEAD is blocked from admin platform endpoints (categories/overview/audit).
      const ov = await req('/api/admin/overview', { headers: hdr(leadToken) });
      assert(ov.status === 403, 'lead: GET /api/admin/overview → 403 (admin-only)');

      // A non-staff user cannot reach the lead API at all.
      const denied = await req('/api/lead/stats/mine', { headers: hdr(userToken) });
      assert(denied.status === 403, 'lead: USER cannot access /api/lead (403)');

      // LEAD can appoint a moderator (target below lead tier).
      const appt = await req(`/api/lead/users/${plain.id}/role`, authJson({ role: 'MODERATOR' }, leadToken));
      assert(appt.status === 200, 'lead: appoint MODERATOR → 200');
      const apptRole = await queryOne<any>('SELECT role FROM users WHERE id = ?', [plain.id]);
      assert(apptRole?.role === 'MODERATOR', 'lead: appointed user persisted as MODERATOR');

      // LEAD cannot mint a chief/admin role (only ADMIN+ can).
      const badChief = await req(`/api/lead/users/${mod.id}/role`, authJson({ role: 'LEAD_MOD' }, leadToken));
      assert(badChief.status === 400, 'lead: cannot assign LEAD_MOD (400)');
      const badAdmin = await req(`/api/lead/users/${mod.id}/role`, authJson({ role: 'ADMIN' }, leadToken));
      assert(badAdmin.status === 400, 'lead: cannot assign ADMIN (400)');

      // ADMIN selects the chief moderator (LEAD_MOD).
      const chief = await req(`/api/admin/users/${mod.id}/role`, authJson({ role: 'LEAD_MOD' }, adminToken));
      assert(chief.status === 200, 'admin: assign LEAD_MOD (chief) → 200');
      const chiefRole = await queryOne<any>('SELECT role FROM users WHERE id = ?', [mod.id]);
      assert(chiefRole?.role === 'LEAD_MOD', 'admin: chief moderator persisted as LEAD_MOD');

      for (const id of [admin.id, lead.id, mod.id, plain.id]) {
        try { await runQuery('DELETE FROM users WHERE id = ?', [id]); } catch {}
      }
    }
  } finally {
    // ── Cleanup (best-effort) ────────────────────────────────────────────────
    try { await runQuery('DELETE FROM verification_uploads WHERE owner_user_id IN (?, ?)', [alice.id, bob.id]); } catch {}
    for (const id of [`usr_integ_dup_${RUN_ID}`, alice.id, bob.id]) {
      try { await runQuery('DELETE FROM users WHERE id = ?', [id]); } catch {}
    }
    try { await runQuery('DELETE FROM email_verification_codes WHERE email LIKE ?', [`%${RUN_ID}%`]); } catch {}
    for (const f of cleanupObjects) { try { fs.rmSync(f, { force: true }); } catch {} }
    await new Promise<void>((resolve) => srv.close(() => resolve()));
    await pool.end().catch(() => {});
  }

  console.log(`=== INTEGRATION RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Integration suite crashed:', err);
  process.exit(1);
});
