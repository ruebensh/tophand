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
  // GSC: testlar hech qachon haqiqiy Google hisobiga ulinmasligi kerak.
  'GSC_CLIENT_EMAIL', 'GSC_PRIVATE_KEY', 'GSC_SITE_URL',
  // Captcha: testlar o'fiq holatda ishlashi kerak (server tekshiruvi o'tkaziladi).
  'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITEKEY',
]) process.env[k] = '';

// SAFETY (critical): integration tests must NEVER touch a real/remote database.
// `.env` may point at production (e.g. a hosted Neon URL) — importing server.ts
// runs `dotenv/config`, so we FORCE a local Postgres here and pre-set
// DATABASE_URL (dotenv cannot overwrite an already-set key). Report #5: the
// blanket `CI` bypass is REMOVED — a bare `CI=true` env must NOT be allowed to
// redirect these tests at a remote/production DB. The target MUST be local
// (127.0.0.1/localhost/::1) even in CI; CI service containers publish Postgres
// on localhost, so this stays compatible while closing the foot-gun.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://tophand:tophand123@127.0.0.1:5432/tophand';
const isLocalTarget = /(127\.0\.0\.1|localhost|::1)/.test(TEST_DB_URL);
if (!isLocalTarget) {
  console.error(
    'REFUSED: integration tests will not run against a non-local DB (CI does NOT ' +
      'bypass this). Set TEST_DATABASE_URL to a throwaway/local Postgres. Target was:\n  ' +
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
  const { generateToken, generateStepUpToken } = await import('../server/auth/telegram.ts');
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
      // Step-up talab qilinadi: parol qayta-tasdiq tokenisiz → 401, token bilan → 200.
      const noStepUp = await req(`/api/admin/users/${mod.id}/role`, authJson({ role: 'LEAD_MOD' }, adminToken));
      assert(noStepUp.status === 401, 'admin: assign role WITHOUT step-up → 401 (stepup_required)');
      const stepupTok = generateStepUpToken({ id: admin.id, role: 'ADMIN' });
      const chief = await req(`/api/admin/users/${mod.id}/role`, {
        ...authJson({ role: 'LEAD_MOD' }, adminToken),
        headers: { ...(authJson({ role: 'LEAD_MOD' }, adminToken).headers as Record<string, string>), 'x-stepup': stepupTok },
      });
      assert(chief.status === 200, 'admin: assign LEAD_MOD with step-up → 200');
      const chiefRole = await queryOne<any>('SELECT role FROM users WHERE id = ?', [mod.id]);
      assert(chiefRole?.role === 'LEAD_MOD', 'admin: chief moderator persisted as LEAD_MOD');

      // ── Report #3: markaziy referatsiya guardi ──
      {
        const { isMediaStillReferenced, deleteStoredMediaIfUnreferenced } = await import('../server/services/mediaCleanupService.ts');
        const sharedRef = `/uploads/listings/shared_ref_${RUN_ID}.webp`;
        await runQuery('UPDATE users SET profile_photo_url = ? WHERE id = ?', [sharedRef, plain.id]);
        assert((await isMediaStillReferenced(sharedRef)) === true, 'guard: shared object detected as still-referenced (report #3)');
        const deleted = await deleteStoredMediaIfUnreferenced(sharedRef);
        assert(deleted === false, 'guard: deleteStoredMediaIfUnreferenced REFUSES to delete a referenced object (report #3)');
        await runQuery('UPDATE users SET profile_photo_url = NULL WHERE id = ?', [plain.id]);
        assert((await isMediaStillReferenced(sharedRef)) === false, 'guard: unreferenced object no longer flagged (report #3)');
      }

      // ── Chat ↔ bildirishnoma sinxronizatsiyasi ──
      // Talab: xabar chatda o'qilsa (suhbat ochilsa) qo'ng'iroqchadagi chat
      // bildirishnomasi ham 'o'qilgan' bo'lishi kerak.
      {
        const bobToken = generateToken(bob);
        const cat = await queryOne<any>('SELECT id FROM categories LIMIT 1');
        const region = await queryOne<any>('SELECT id FROM regions LIMIT 1');
        const district = await queryOne<any>('SELECT id FROM districts LIMIT 1');
        if (cat && region && district) {
          const listingId = `lst_integ_chat_${RUN_ID}`;
          await runQuery(
            `INSERT INTO listings (id, owner_user_id, type, title, description, category_id, region_id, district_id, price_type, status, created_at, updated_at, expires_at)
             VALUES (?, ?, 'SERVICE_OFFER', ?, ?, ?, ?, ?, 'FIXED', 'ACTIVE', NOW(), NOW(), NOW() + INTERVAL '30 days')`,
            [listingId, bob.id, `Integ Chat Listing ${RUN_ID}`, 'desc', cat.id, region.id, district.id]
          );

          // 1) alice bob e'loni bo'yicha suhbat ochadi (recipient = bob)
          const startRes = await req('/api/chat/start', authJson({ listing_id: listingId }, aliceToken));
          const conv = await startRes.json();
          assert(startRes.status === 200 && conv.id, 'chat: alice opens conversation on bob listing → 200');

          // 2) alice xabar yuboradi → bob uchun O'QILMAGAN NEW_CHAT_MESSAGE tug'iladi
          const sendRes = await req(`/api/chat/conversations/${conv.id}/messages`, authJson({ text: 'Salom, narqi qanday?' }, aliceToken));
          assert(sendRes.status === 201, 'chat: alice sends message → 201');
          const notifBefore = await queryOne<any>(
            `SELECT read_at FROM notifications WHERE user_id = ? AND type = 'NEW_CHAT_MESSAGE' AND link = ?`,
            [bob.id, `/chat?conv=${conv.id}`]
          );
          assert(!!notifBefore && notifBefore.read_at === null, 'chat: recipient gets UNREAD chat notification');

          // 3) bob suhbatni ochadi (GET) → server chat bildirishnomasini 'o'qilgan' qiladi
          const openRes = await req(`/api/chat/conversations/${conv.id}`, { headers: { authorization: `Bearer ${bobToken}` } });
          assert(openRes.status === 200, 'chat: bob opens conversation → 200');
          const notifAfter = await queryOne<any>(
            `SELECT read_at FROM notifications WHERE user_id = ? AND type = 'NEW_CHAT_MESSAGE' AND link = ?`,
            [bob.id, `/chat?conv=${conv.id}`]
          );
          assert(!!notifAfter && notifAfter.read_at !== null, 'chat sync: opening conversation marks chat notification READ');

          try { await runQuery('DELETE FROM notifications WHERE link = ?', [`/chat?conv=${conv.id}`]); } catch {}
          try { await runQuery('DELETE FROM listings WHERE id = ?', [listingId]); } catch {}
        } else {
          assert(false, 'chat sync: seeded category/region/district available for fixture');
        }
      }

      // ── Yakunlash hisoblagichi + qayta ochish ──
      // Talab: e'lon har yakunlanganda completion_count +1; egasi yangi e'lon ochmasdan
      // uni qayta ochishi (renew) mumkin va yana yakunlasa hisoblagich 2 bo'ladi.
      // (ADMIN billing-exempt => uzaytirish/vakinsiz to'lov, test to'ovga to'yxamaydi.)
      {
        const owner = await mkUser(`usr_integ_reopen_${RUN_ID}`, `reopen_${RUN_ID}@integ.example`, 'ADMIN');
        const ownerToken = generateToken(owner);
        const cat = await queryOne<any>('SELECT id FROM categories LIMIT 1');
        const region = await queryOne<any>('SELECT id FROM regions LIMIT 1');
        const district = await queryOne<any>('SELECT id FROM districts LIMIT 1');
        if (cat && region && district) {
          const listingId = `lst_integ_reopen_${RUN_ID}`;
          await runQuery(
            `INSERT INTO listings (id, owner_user_id, type, title, description, category_id, region_id, district_id, price_type, status, created_at, updated_at, expires_at)
             VALUES (?, ?, 'SERVICE_OFFER', ?, ?, ?, ?, ?, 'FIXED', 'ACTIVE', NOW(), NOW(), NOW() + INTERVAL '30 days')`,
            [listingId, owner.id, `Integ Reopen Listing ${RUN_ID}`, 'desc', cat.id, region.id, district.id]
          );

          // 1) Birinchi yakunlash → COMPLETED, completion_count = 1
          const c1 = await req(`/api/listings/${listingId}/complete`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } });
          assert(c1.status === 200, 'reopen: first /complete → 200');
          const afterC1 = await queryOne<any>('SELECT status, completion_count FROM listings WHERE id = ?', [listingId]);
          assert(afterC1?.status === 'COMPLETED' && Number(afterC1?.completion_count) === 1, 'reopen: after 1st complete status=COMPLETED & count=1');

          // 2) Qayta ochish (renew) → ACTIVE, count saqlanadi, completed_at tozalanadi
          const r1 = await req(`/api/listings/${listingId}/renew`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } });
          assert(r1.status === 200, 'reopen: COMPLETED listing can be reopened via /renew → 200');
          const afterReopen = await queryOne<any>('SELECT status, completion_count, completed_at FROM listings WHERE id = ?', [listingId]);
          assert(afterReopen?.status === 'ACTIVE' && Number(afterReopen?.completion_count) === 1 && afterReopen?.completed_at === null, 'reopen: reopened to ACTIVE, count kept=1, completed_at cleared');

          // 3) Yana yakunlash → count = 2
          const c2 = await req(`/api/listings/${listingId}/complete`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } });
          assert(c2.status === 200, 'reopen: second /complete → 200');
          const afterC2 = await queryOne<any>('SELECT completion_count FROM listings WHERE id = ?', [listingId]);
          assert(Number(afterC2?.completion_count) === 2, 'reopen: after 2nd complete count=2');

          // 4) Allaqachon COMPLETED'ni qayta yakunlash count'ni ikki baravar oshirmaydi
          const c3 = await req(`/api/listings/${listingId}/complete`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } });
          const afterC3 = await queryOne<any>('SELECT completion_count FROM listings WHERE id = ?', [listingId]);
          assert(c3.status === 200 && Number(afterC3?.completion_count) === 2, 'reopen: re-completing an already-COMPLETED listing does not double-increment');

          try { await runQuery('DELETE FROM notifications WHERE user_id = ?', [owner.id]); } catch {}
          try { await runQuery('DELETE FROM listings WHERE id = ?', [listingId]); } catch {}
          try { await runQuery('DELETE FROM users WHERE id = ?', [owner.id]); } catch {}
        } else {
          assert(false, 'reopen: seeded category/region/district available for fixture');
        }
      }

      // ── Qoralama (DRAFT): tozalash + har 2 kunda eslatma ──
      // Talab: egasi bitta va barcha qoralamalarini butunlay o'chira oladi;
      // eslatma cron'i har egaga 2 kunda eng ko'pi bilan 1 ta eslatma beradi.
      {
        const owner = await mkUser(`usr_integ_draft_${RUN_ID}`, `draft_${RUN_ID}@integ.example`);
        const ownerToken = generateToken(owner);
        const cat = await queryOne<any>('SELECT id FROM categories LIMIT 1');
        const region = await queryOne<any>('SELECT id FROM regions LIMIT 1');
        const district = await queryOne<any>('SELECT id FROM districts LIMIT 1');
        if (cat && region && district) {
          const mkDraft = async (id: string, ageDays: number) => {
            await runQuery(
              `INSERT INTO listings (id, owner_user_id, type, title, description, category_id, region_id, district_id, price_type, status, created_at, updated_at, expires_at)
               VALUES (?, ?, 'SERVICE_OFFER', ?, ?, ?, ?, ?, 'FIXED', 'DRAFT', NOW() - (? || ' days')::INTERVAL, NOW(), NOW() + INTERVAL '30 days')`,
              [id, owner.id, `Draft ${id}`, 'desc', cat.id, region.id, district.id, String(ageDays)]
            );
          };

          const d1 = `lst_integ_draft1_${RUN_ID}`;
          const d2 = `lst_integ_draft2_${RUN_ID}`;
          const d3 = `lst_integ_draft3_${RUN_ID}`;
          await mkDraft(d1, 3);
          await mkDraft(d2, 3);
          await mkDraft(d3, 0); // yangi — 24h derazasidan tashqarida, eslatma sababchisi emas

          // Eslatma cron'ini chaqiramiz (eski qoralamalar uchun 1 consolidated eslatma)
          await runQuery(`DELETE FROM notifications WHERE user_id = ? AND type = 'DRAFT_REMINDER'`, [owner.id]);
          const { processDraftReminders } = await import('../server/services/draftReminderService.ts');
          await processDraftReminders();
          const cnt1 = await queryOne<any>(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND type = 'DRAFT_REMINDER'`, [owner.id]);
          assert(Number(cnt1?.c) >= 1, 'draft reminder: old drafts trigger a DRAFT_REMINDER');

          // Dedup: 2 kunlik deraza ichida qayta chaqirish eslatma qo'shmaydi
          await processDraftReminders();
          const cnt2 = await queryOne<any>(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND type = 'DRAFT_REMINDER'`, [owner.id]);
          assert(Number(cnt2?.c) === Number(cnt1?.c), 'draft reminder: re-run within 2 days does NOT add a reminder (dedup)');

          // Bitta qoralamani o'chirish → hard-delete (qator yo'qoladi)
          const delOne = await req(`/api/listings/${d3}`, { method: 'DELETE', headers: { authorization: `Bearer ${ownerToken}` } });
          assert(delOne.status === 200, 'draft: DELETE /:id (DRAFT) → 200');
          const goneRow = await queryOne<any>('SELECT id FROM listings WHERE id = ?', [d3]);
          assert(!goneRow, 'draft: single DRAFT is hard-deleted (row removed)');

          // Barcha qoralamalarni tozalash
          const clear = await req('/api/listings/drafts/mine', { method: 'DELETE', headers: { authorization: `Bearer ${ownerToken}` } });
          const clearJson = await clear.json();
          assert(clear.status === 200 && Number(clearJson.deleted) >= 2, 'draft: DELETE /drafts/mine → 200 & deleted>=2');
          const remaining = await queryOne<any>(`SELECT COUNT(*) AS c FROM listings WHERE owner_user_id = ? AND status = 'DRAFT'`, [owner.id]);
          assert(Number(remaining?.c) === 0, 'draft: after clear, no DRAFT rows remain for owner');

          try { await runQuery('DELETE FROM notifications WHERE user_id = ?', [owner.id]); } catch {}
          try { await runQuery('DELETE FROM listings WHERE owner_user_id = ?', [owner.id]); } catch {}
          try { await runQuery('DELETE FROM users WHERE id = ?', [owner.id]); } catch {}
        } else {
          assert(false, 'draft: seeded category/region/district available for fixture');
        }
      }

      // ── Katalog + Kategoriya: image_url va tartib (reorder) ──
      {
        const mkA = await req('/api/catalogs', { ...authJson({ name_uz: `Integ A ${RUN_ID}`, slug: `itg-cat-a-${RUN_ID}`, icon: 'Wrench', listing_types: 'SERVICE_OFFER', image_url: '/uploads/catalogs/a.webp', sort_order: 5 }, adminToken) });
        assert(mkA.status === 201, 'catalog: POST /api/catalogs → 201');
        const aBody: any = await mkA.json().catch(() => ({}));
        const catAId = aBody?.id;
        assert(aBody?.image_url === '/uploads/catalogs/a.webp', 'catalog: image_url saqlandi');

        const mkB = await req('/api/catalogs', { ...authJson({ name_uz: `Integ B ${RUN_ID}`, slug: `itg-cat-b-${RUN_ID}`, listing_types: 'SELL', sort_order: 6 }, adminToken) });
        const bBody: any = await mkB.json().catch(() => ({}));
        const catBId = bBody?.id;

        // GET /api/catalogs/all (admin) yangi katalogni image_url bilan qaytaradi
        const all = await req('/api/catalogs/all', { headers: { authorization: `Bearer ${adminToken}` } });
        const allBody: any = await all.json().catch(() => []);
        const foundA = Array.isArray(allBody) && allBody.find((c: any) => c.id === catAId);
        assert(all.status === 200 && !!foundA && foundA.image_url === '/uploads/catalogs/a.webp', 'catalog: GET /api/catalogs/all includes new catalog + image_url');

        // Reorder: B oldinga, A orqaga → sort_order index bo'yicha
        const ro = await req('/api/catalogs/reorder', { ...authJson({ order: [catBId, catAId] }, adminToken) });
        assert(ro.status === 200, 'catalog: POST /api/catalogs/reorder → 200');
        const aRow = await queryOne<any>('SELECT sort_order FROM catalogs WHERE id = ?', [catAId]);
        const bRow = await queryOne<any>('SELECT sort_order FROM catalogs WHERE id = ?', [catBId]);
        assert(Number(bRow?.sort_order) === 0 && Number(aRow?.sort_order) === 1, 'catalog: reorder sets sort_order by index');

        // Kategoriya: image_url + reorder
        const k1res = await req('/api/admin/categories', { ...authJson({ name_uz: `Integ K1 ${RUN_ID}`, slug: `itg-k1-${RUN_ID}`, catalog_id: catAId, image_url: '/uploads/categories/k1.webp', sort_order: 3 }, adminToken) });
        assert(k1res.status === 201, 'category: POST /api/admin/categories → 201');
        const k1body: any = await k1res.json().catch(() => ({}));
        assert(k1body?.image_url === '/uploads/categories/k1.webp', 'category: image_url saqlandi');
        const k2res = await req('/api/admin/categories', { ...authJson({ name_uz: `Integ K2 ${RUN_ID}`, slug: `itg-k2-${RUN_ID}`, catalog_id: catAId, sort_order: 4 }, adminToken) });
        const k2body: any = await k2res.json().catch(() => ({}));
        const cr = await req('/api/admin/categories/reorder', { ...authJson({ order: [k2body.id, k1body.id] }, adminToken) });
        assert(cr.status === 200, 'category: POST /api/admin/categories/reorder → 200');
        const kc1 = await queryOne<any>('SELECT sort_order FROM categories WHERE id = ?', [k1body.id]);
        const kc2 = await queryOne<any>('SELECT sort_order FROM categories WHERE id = ?', [k2body.id]);
        assert(Number(kc2?.sort_order) === 0 && Number(kc1?.sort_order) === 1, 'category: reorder sets sort_order by index');

        // PUT image_url='' tozalaydi (COALESCE emas, aniq bo'sh satr)
        await req(`/api/admin/categories/${k1body.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ image_url: '' }) });
        const kc1c = await queryOne<any>('SELECT image_url FROM categories WHERE id = ?', [k1body.id]);
        assert((kc1c?.image_url ?? '') === '', 'category: PUT image_url="" tozalaydi');

        // Cleanup (FK tartibi: avval kategoriyalar, keyin kataloglar)
        try { await runQuery('DELETE FROM categories WHERE catalog_id = ?', [catAId]); } catch {}
        try { await runQuery('DELETE FROM catalogs WHERE id IN (?, ?)', [catAId, catBId]); } catch {}
      }

      // ── Mobil UA cheklovi: staff API smartfondan bloklanadi, oddiy so'rovlar o'tadi ──
      {
        const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
        const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

        const mb1 = await req('/api/admin/overview', { headers: { authorization: `Bearer ${adminToken}`, 'user-agent': MOBILE_UA } });
        const mb1j: any = await mb1.json().catch(() => ({}));
        assert(mb1.status === 403 && mb1j?.error === 'mobile_blocked', 'mobil UA: /api/admin → 403 mobile_blocked');

        const mb2 = await req('/api/moderation/queue/pool', { headers: { authorization: `Bearer ${adminToken}`, 'user-agent': MOBILE_UA } });
        assert(mb2.status === 403, 'mobil UA: /api/moderation (staff) → 403');

        const mobPost = authJson({ name_uz: `Mob ${RUN_ID}`, slug: `itg-mob-${RUN_ID}`, listing_types: 'SELL' }, adminToken);
        const mb3 = await req('/api/catalogs', { ...mobPost, headers: { ...(mobPost.headers as any), 'user-agent': MOBILE_UA } });
        assert(mb3.status === 403, 'mobil UA: POST /api/catalogs (admin) → 403');

        const mb4 = await req('/api/admin/overview', { headers: { authorization: `Bearer ${adminToken}`, 'user-agent': DESKTOP_UA } });
        assert(mb4.status === 200, 'desktop UA: /api/admin → 200 (ruxsat etilgan)');

        const mb5 = await req('/api/catalogs', { headers: { 'user-agent': MOBILE_UA } });
        assert(mb5.status === 200, 'mobil UA: GET /api/catalogs (public) → 200, ta\'sirlanmaydi');
      }
      
      // ── Seed non-destructive: syncCategories() admin o'zgarishlarini qayta yozmaydi ──
      {
        const anyCat = await queryOne<any>('SELECT id, sort_order FROM catalogs ORDER BY created_at ASC LIMIT 1');
        if (anyCat) {
          const newOrder = Number(anyCat.sort_order ?? 0) === 77 ? 78 : 77;
          await runQuery('UPDATE catalogs SET sort_order = ? WHERE id = ?', [newOrder, anyCat.id]);
          // Admin panel orqali qo'shilgan kategoriya (seed'da yo'q id)
          const kRes = await req('/api/admin/categories', { ...authJson({ name_uz: `Integ SeedK ${RUN_ID}`, slug: `itg-seedk-${RUN_ID}`, catalog_id: anyCat.id }, adminToken) });
          const kBody: any = await kRes.json().catch(() => ({}));
          const { syncCategories } = await import('../server/db/init.ts');
          await syncCategories();
          const after = await queryOne<any>('SELECT sort_order FROM catalogs WHERE id = ?', [anyCat.id]);
          assert(Number(after?.sort_order) === newOrder, "seed: syncCategories katalog sort_order'ini qayta yozmaydi");
          const kAfter = await queryOne<any>('SELECT is_active FROM categories WHERE id = ?', [kBody.id]);
          assert(!!kAfter && Number(kAfter.is_active) === 1, "seed: admin qo'shgan kategoriya sync'dan keyin ham faol");
          try { await runQuery('DELETE FROM categories WHERE id = ?', [kBody.id]); } catch {}
          try { await runQuery('UPDATE catalogs SET sort_order = ? WHERE id = ?', [Number(anyCat.sort_order ?? 0), anyCat.id]); } catch {}
        }
      }

      // ── Excel import / export: users + regions/districts regressiyasi ──
      {
        const XLSX_CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const ex1 = await req('/api/admin/export/users', { headers: hdr(adminToken) });
        const ex1buf = Buffer.from(await ex1.arrayBuffer());
        assert(ex1.status === 200 && ex1buf.length > 100, 'excel: GET /api/admin/export/users → 200 (.xlsx bayt)');
        assert((ex1.headers.get('content-type') || '').includes('spreadsheetml'), 'excel: export Content-Type — spreadsheetml');

        // Regressiya: regions/districts jadvallarida created_at yo'q — avval xato berardi
        const ex2 = await req('/api/admin/export/regions', { headers: hdr(adminToken) });
        assert(ex2.status === 200, 'excel: GET /api/admin/export/regions → 200 (created_at regressiyasi)');
        const ex3 = await req('/api/admin/export/districts', { headers: hdr(adminToken) });
        assert(ex3.status === 200, 'excel: GET /api/admin/export/districts → 200');

        // users import: 2 yangi qator + 1 buzuq qator (name yo'q) — batch upsert + per-row xato
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        const sh = wb.addWorksheet('Foydalanuvchilar');
        sh.columns = [{ header: 'id', key: 'id' }, { header: 'name', key: 'name' }, { header: 'phone', key: 'phone' }];
        sh.addRow({ id: `usr_integ_xl_${RUN_ID}_a`, name: 'Excel A', phone: '+998900000001' });
        sh.addRow({ id: `usr_integ_xl_${RUN_ID}_b`, name: 'Excel B', phone: '+998900000002' });
        sh.addRow({ id: `usr_integ_xl_${RUN_ID}_c`, name: '', phone: '+998900000003' });
        const xlBuf = Buffer.from(await wb.xlsx.writeBuffer());
        const fd = new FormData();
        fd.append('file', new Blob([xlBuf], { type: XLSX_CT }), 'users.xlsx');
        const im1 = await req('/api/admin/import/users', { method: 'POST', headers: hdr(adminToken), body: fd });
        const rep1: any = await im1.json().catch(() => ({}));
        assert(im1.status === 200 && rep1.inserted === 2, 'excel: POST /api/admin/import/users → 2 qator import qilindi');
        assert(Array.isArray(rep1.errors) && rep1.errors.length === 1 && rep1.errors[0].row > 0, 'excel: import — buzuq qator alohida xabar qilindi');
        const inDb = await queryOne<any>('SELECT count(*)::int AS c FROM users WHERE id LIKE ?', [`usr_integ_xl_${RUN_ID}%`]);
        assert(Number(inDb?.c) === 2, "excel: importlangan foydalanuvchilar DB'da");

        // Takroriy import → updated sanaladi (insert emas — upsert aniq)
        const fd2 = new FormData();
        fd2.append('file', new Blob([xlBuf], { type: XLSX_CT }), 'users.xlsx');
        const im2 = await req('/api/admin/import/users', { method: 'POST', headers: hdr(adminToken), body: fd2 });
        const rep2: any = await im2.json().catch(() => ({}));
        assert(im2.status === 200 && rep2.inserted === 0 && rep2.updated === 2, 'excel: takroriy import → updated hisobladi');

        try { await runQuery('DELETE FROM users WHERE id LIKE ?', [`usr_integ_xl_${RUN_ID}%`]); } catch {}
      }

      // ── Top qidiruv so'zlari (topbar typewriter placeholder) ──
      {
        const tkRes = await req('/api/listings/top-keywords');
        assert(tkRes.status === 200, `top-keywords 200 (got ${tkRes.status})`);
        const tkBody: any = await tkRes.json().catch(() => ({}));
        const tk = tkBody?.keywords;
        assert(Array.isArray(tk) && tk.length > 0 && tk.length <= 15, `1..15 ta so'z (got ${Array.isArray(tk) ? tk.length : 'no'})`);
        assert(tk.every((k: any) => typeof k === 'string' && k.trim().length >= 3), 'barcha so\'zlar 3+ belgili matn');
        const tkRes2 = await req('/api/listings/top-keywords'); // keshlangan javob barqaror
        const tkBody2: any = await tkRes2.json().catch(() => ({}));
        assert(tkRes2.status === 200 && tkBody2?.keywords?.length === tk.length, 'kesh javobi barqaror');

        // Qidiruv logi: bir xil so'z 15 daqiqa ichida bir marta sanaladi,
        // 2 belgidan qisqa fragmentlar yozilmaydi (admin statistikasi tozaligi).
        const probeKw = `zz_kws_${RUN_ID}`;
        try { await runQuery("DELETE FROM search_filter_logs WHERE keyword = ?", [probeKw]); } catch {}
        const kwRes1 = await req(`/api/listings?keyword=${probeKw}&limit=1`);
        assert(kwRes1.status === 200, `keyword qidiruvi 200 (o.name regressiyasi; got ${kwRes1.status})`);
        await new Promise((r) => setTimeout(r, 150)); // fire-and-forget insert1 yetishiga imkon
        await req(`/api/listings?keyword=${probeKw}&limit=1`);
        await new Promise((r) => setTimeout(r, 150));
        await req(`/api/listings?keyword=${probeKw}&limit=1&page=2`);
        await new Promise((r) => setTimeout(r, 400)); // fire-and-forget loglarga ulgurish
        const logRow: any = await queryOne('SELECT COUNT(*)::int AS c FROM search_filter_logs WHERE keyword = ?', [probeKw]);
        assert(logRow.c === 1, `dedup: 3 ta takroriy qidiruv 1 marta sanaldi (got ${logRow.c})`);
        await req(`/api/listings?keyword=a&limit=1`); // 1 belgili fragment
        await new Promise((r) => setTimeout(r, 300));
        const fragRow: any = await queryOne("SELECT COUNT(*)::int AS c FROM search_filter_logs WHERE keyword = 'a'");
        assert(fragRow.c === 0, '1 belgili fragment loglanmaydi');
        try { await runQuery('DELETE FROM search_filter_logs WHERE keyword = ?', [probeKw]); } catch {}
      }

      // ── SEO: sitemap.xml professional + Google Image sitemap ──
      {
        const cat = await queryOne<any>('SELECT id FROM categories LIMIT 1');
        const region = await queryOne<any>('SELECT id FROM regions LIMIT 1');
        const district = await queryOne<any>('SELECT id FROM districts LIMIT 1');
        if (cat && region && district) {
          const seoListing = `lst_sitemap_${RUN_ID}`;
          await runQuery(
            `INSERT INTO listings (id, owner_user_id, type, title, description, category_id, region_id, district_id, price_type, status, created_at, updated_at, expires_at)
             VALUES (?, ?, 'SERVICE_OFFER', ?, ?, ?, ?, ?, 'FIXED', 'ACTIVE', NOW(), NOW(), NOW() + INTERVAL '30 days')`,
            [seoListing, bob.id, `Usta xizmati ${RUN_ID}`, 'Sifatli mezon uchun yetarlicha uzun tavsif matni.', cat.id, region.id, district.id]
          );
          await runQuery(
            `INSERT INTO listing_images (id, listing_id, url, sort_order, media_type, created_at) VALUES (?, ?, ?, 0, 'image', NOW())`,
            [`img_sitemap_${RUN_ID}`, seoListing, '/uploads/listings/seo-test.webp']
          );

          const sm = await req('/sitemap.xml');
          const xml = await sm.text();
          assert(sm.status === 200 && /<urlset[^>]*xmlns:image="[^"]*sitemap-image/.test(xml), 'seo: /sitemap.xml 200 + image namespace declared');
          assert(xml.includes(`/listing/${seoListing}`), 'seo: quality listing URL present in sitemap');
          const blkStart = xml.indexOf(`/listing/${seoListing}`);
          const within = xml.slice(blkStart, xml.indexOf('</url>', blkStart));
          assert(/<image:loc>[^<]*\/uploads\/listings\/seo-test\.webp<\/image:loc>/.test(within), 'seo: listing has <image:loc> (Image sitemap)');
          assert(/<lastmod>/.test(within) && !new RegExp(`<lastmod>${new Date().toISOString().slice(0, 10)}T00:00`).test(within), 'seo: listing lastmod is a real content timestamp');

          const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
          assert(!xml.includes('/hudud/'), 'seo: no /hudud/ (city) URLs in sitemap');
          assert(locs.some((l) => /\/\?catalog=.+/.test(l)), 'seo: catalog (?catalog=) URLs present in sitemap');
          assert(!locs.some((l) => /\/(contact|terms|privacy)$/.test(l)), 'seo: no contact/terms/privacy in sitemap (noindex pages excluded)');
          assert(!/changefreq>hourly</.test(xml), 'seo: request-time "hourly" lastmod noise removed');

          try { await runQuery('DELETE FROM listing_images WHERE listing_id = ?', [seoListing]); } catch {}
          try { await runQuery('DELETE FROM listings WHERE id = ?', [seoListing]); } catch {}
        } else {
          assert(false, 'seo: seeded category/region/district available for sitemap fixture');
        } 
      }

      // ── AI yordamchi: filtr to'ldirish + tavsif generatsiyasi ──
      // E'lon yaratish oqimidagi ikkita ochiq AI endpointni tekshiramiz.
      {
        const jsonPost = (body: any): RequestInit => ({
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const attrCat = await queryOne<any>(
          `SELECT category_id FROM category_attributes GROUP BY category_id ORDER BY COUNT(*) DESC LIMIT 1`
        );
        let schemaKeys: string[] = [];
        if (attrCat) {
          const k = await queryOne<any>(
            'SELECT array_agg(key) AS keys FROM category_attributes WHERE category_id = ?',
            [attrCat.category_id]
          );
          schemaKeys = k?.keys || [];
        }

        // 1) prefill-attributes: 200 va qaytgan kalitlar sxemada (uydurma maydon yo'q).
        const pre = await req('/api/ai/prefill-attributes', jsonPost({
          title: 'Chevrolet Cobalt 2020 avtomat',
          category_id: attrCat?.category_id,
        }));
        assert(pre.status === 200, 'ai: POST /api/ai/prefill-attributes → 200');
        const preJson = await pre.json();
        assert(preJson && typeof preJson.values === 'object', 'ai: prefill-attributes returns a values object');
        assert(Object.keys(preJson.values || {}).every((k) => schemaKeys.includes(k)), 'ai: prefill values are all valid schema keys (no invented fields)');

        // 2) sarlavhasiz → 400.
        const bad = await req('/api/ai/prefill-attributes', jsonPost({ category_id: attrCat?.category_id }));
        assert(bad.status === 400, 'ai: prefill-attributes without title → 400');

        // 3) generate-description: 200 va haqiqiy tavsif (AI yo'q bo'lsa ham fallback ishlaydi).
        const gd = await req('/api/ai/generate-description', jsonPost({
          title: 'Chevrolet Cobalt 2020',
          categoryName: 'Avtomobillar',
          attributes: [{ label: 'Yili', value: '2020' }, { label: 'Uzatmalar qutisi', value: 'Avtomat' }],
          priceText: '55 000 000 so‘m',
        }));
        assert(gd.status === 200, 'ai: POST /api/ai/generate-description → 200');
        const gdJson = await gd.json();
        assert(typeof gdJson.description === 'string' && gdJson.description.trim().length >= 15, 'ai: generate-description returns a real description (>=15 chars)');
        
                // 4) Kesh: bir xil tavsif payload'i → ikkinchi so'rov keshdan (cached:true).
                // Fallback har doim tavsif ishlagani uchun bu Gemini kalitidan qat'iye ani.
                const gd2 = await req('/api/ai/generate-description', jsonPost({
                  title: 'Chevrolet Cobalt 2020',
                  categoryName: 'Avtomobillar',
                  attributes: [{ label: 'Yili', value: '2020' }, { label: 'Uzatmalar qutisi', value: 'Avtomat' }],
                  priceText: '55 000 000 so‘m',
                }));
                const gd2Json = await gd2.json();
                assert(gd2Json.cached === true, 'ai: generate-description second identical call hits cache (cached:true)');
                assert(typeof gd2Json.description === 'string' && gd2Json.description === gdJson.description, 'ai: cached description matches original');
        
                // 5) prefill javobida `cached` bayrog'i boolean ko'rinishida qaytadi.
                assert(typeof preJson.cached === 'boolean', 'ai: prefill-attributes returns a boolean cached flag');
      }

      // ─── Skills autosuggest (job_skills lug'ati) ───
      {
        const all = await req('/api/skills?limit=5');
        assert(all.status === 200, 'skills: GET /api/skills → 200');
        const allJson = await all.json();
        assert(Array.isArray(allJson) && allJson.length > 0, 'skills: seed present (top list non-empty)');
        assert(allJson.length <= 5, 'skills: limit param respected');

        const po = await req('/api/skills?q=po');
        const poJson = await po.json();
        assert(Array.isArray(poJson), 'skills: q filter returns an array');
        assert(poJson.every((x: any) => typeof x.name === 'string'), 'skills: each item has a string name');
        assert(poJson.some((x: any) => String(x.name).toLowerCase().includes('po')), 'skills: q matches returned names (e.g. PostgreSQL/Postman)');
      }

      // ─── Admin aktivlik: user_events + /visits + GSC konfiguratsiyasi ───
      {
        const hdrA = (tk: string) => ({ authorization: `Bearer ${tk}` });
        await runQuery('DELETE FROM user_events WHERE user_id IN (?, ?)', [alice.id, bob.id]);

        // POST /api/auth/logout → LOGOUT yoziladi (requireAuth).
        const noTok = await req('/api/auth/logout', { method: 'POST' });
        assert(noTok.status === 401, 'activity: logout talabi tokensiz → 401');
        const lo = await req('/api/auth/logout', { method: 'POST', headers: hdrA(aliceToken) });
        assert(lo.status === 200, 'activity: POST /api/auth/logout → 200');
        const loRow = await queryOne<any>(
          "SELECT * FROM user_events WHERE user_id = ? AND event_type = 'LOGOUT' ORDER BY created_at DESC LIMIT 1",
          [alice.id]
        );
        assert(!!loRow, 'activity: logout user_eventsga LOGOUT yozdi');

        // Sessiya trafigi: POST /api/auth/visit → VISIT, /api/auth/leave → EXIT.
        const noVisit = await req('/api/auth/visit', { method: 'POST' });
        assert(noVisit.status === 401, 'activity: /visit tokensiz → 401');
        const vis = await req('/api/auth/visit', { method: 'POST', headers: hdrA(aliceToken) });
        assert(vis.status === 200, 'activity: POST /api/auth/visit → 200');
        const visRow = await queryOne<any>(
          "SELECT * FROM user_events WHERE user_id = ? AND event_type = 'VISIT' ORDER BY created_at DESC LIMIT 1",
          [alice.id]
        );
        assert(!!visRow, 'activity: /visit user_eventsga VISIT yozdi');
        const lea = await req('/api/auth/leave', { method: 'POST', headers: hdrA(aliceToken) });
        assert(lea.status === 200, 'activity: POST /api/auth/leave → 200');
        const leaRow = await queryOne<any>(
          "SELECT * FROM user_events WHERE user_id = ? AND event_type = 'EXIT' ORDER BY created_at DESC LIMIT 1",
          [alice.id]
        );
        assert(!!leaRow, 'activity: /leave user_eventsga EXIT yozdi');

        // CHECK cheklovi: noma'lum event_type rad etilishi kerak.
        let chkRejected = false;
        try {
          await runQuery(
            "INSERT INTO user_events (id, user_id, event_type, created_at) VALUES ('uev_integ_bad', ?, 'HACK', NOW())",
            [alice.id]
          );
        } catch { chkRejected = true; }
        assert(chkRejected, 'activity: user_events CHECK constraint rejects unknown event_type');

        // /api/admin/visits — admin-only + 0-to'ldirilgan kunlik seriya.
        const forbidden = await req('/api/admin/visits?days=14', { headers: hdrA(userToken) });
        assert(forbidden.status === 403, 'activity: GET /api/admin/visits USER uchun yopiq (403)');
        // Bob uchun navbatda 2 ta VISIT qo'shamiz (bugun, UTC bo'yicha).
        for (let i = 0; i < 2; i++) {
          await runQuery(
            "INSERT INTO user_events (id, user_id, event_type, auth_method, created_at) VALUES (?, ?, 'VISIT', 'PASSWORD', NOW())",
            [`uev_integ_${RUN_ID}_${i}`, bob.id]
          );
        }
        const vs = await req('/api/admin/visits?days=14', { headers: hdrA(adminToken) });
        assert(vs.status === 200, 'activity: GET /api/admin/visits admin → 200');
        const vsJson = await vs.json();
        assert(vsJson.days === 14 && Array.isArray(vsJson.series) && vsJson.series.length === 14, 'activity: visits series 14 kun (0-to\'ldirish)');
        const utcToday = new Date().toISOString().slice(0, 10);
        const todayRow = (vsJson.series || []).find((r: any) => r.date === utcToday);
        assert(!!todayRow && Number(todayRow.logins) >= 2, 'activity: bugungi VISITlar soniyada ko\'rindi (bob x2)');
        const exitSum = (vsJson.series || []).reduce((s: number, r: any) => s + Number(r.logouts), 0);
        assert(exitSum >= 1, 'activity: EXIT hisobi series\'ga tushdi');

        // Oylik /visits?months=12 — generate_series(interval) SQL runtime'da ishlashi, 12 oy.
        const vm = await req('/api/admin/visits?months=12', { headers: hdrA(adminToken) });
        const vmJson = await vm.json();
        assert(vm.status === 200 && vmJson.months === 12 && Array.isArray(vmJson.series) && vmJson.series.length === 12, 'activity: visits?months=12 → 12 oylik seriya');
        const utcMonth = new Date().toISOString().slice(0, 7);
        const monthRow = (vmJson.series || []).find((r: any) => r.month === utcMonth);
        assert(!!monthRow && Number(monthRow.logins) >= 2, 'activity: joriy oy VISITlari oylik seriyada ko\'rindi');

        // GSC: konfiguratsiyasiz → NOT_CONFIGURED (test env'da GSC_* bo'shatildi).
        await runQuery("DELETE FROM system_settings WHERE key IN ('gsc_client_email','gsc_private_key','gsc_site_url')").catch(() => {});
        const ga = await req('/api/admin/gsc-analytics', { headers: hdrA(adminToken) });
        const gaJson = await ga.json();
        assert(ga.status === 200 && gaJson.status === 'NOT_CONFIGURED', 'activity: gsc-analytics konfiguratsiyasiz → NOT_CONFIGURED');
        const gaM = await req('/api/admin/gsc-analytics?months=12', { headers: hdrA(adminToken) });
        const gaMJson = await gaM.json();
        assert(gaM.status === 200 && gaMJson.status === 'NOT_CONFIGURED', 'activity: gsc-analytics?months=12 konfiguratsiyasiz → NOT_CONFIGURED');
        const gc = await req('/api/admin/gsc/config', { headers: hdrA(adminToken) });
        const gcJson = await gc.json();
        assert(gc.status === 200 && gcJson.configured === false, 'activity: gsc/config configured=false holda keladi');
        assert(!('private_key' in gcJson), 'activity: gsc/config private_key QAYTARMAYDI');

        // PUT qismiy config → configured qolmaydi; GET'da secret aks etmasligi kerak.
        const putRes = await req('/api/admin/gsc/config', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', ...hdrA(adminToken) },
          body: JSON.stringify({ client_email: `integ_${RUN_ID}@example.iam.gserviceaccount.com`, site_url: 'https://www.tophand.uz/' }),
        });
        assert(putRes.status === 200, 'activity: PUT /api/admin/gsc/config → 200');
        const gc2 = await req('/api/admin/gsc/config', { headers: hdrA(adminToken) });
        const gc2Json = await gc2.json();
        assert(gc2Json.configured === false && gc2Json.client_email.includes('integ_'), 'activity: gsc/config PUT saqlaydi, lekin to\'liq bo\'lmaguncha configured=false');
        assert(!JSON.stringify(gc2Json).includes('PRIVATE KEY'), 'activity: gsc/config javobida secret yo\'q');

        try { await runQuery('DELETE FROM user_events WHERE user_id IN (?, ?)', [alice.id, bob.id]); } catch {}
        try { await runQuery("DELETE FROM system_settings WHERE key IN ('gsc_client_email','gsc_private_key','gsc_site_url')"); } catch {}
      }

      // ── Qoralama (DRAFT) + bog'liq atributlar + captcha-o'fiq ──
      // Admin billing-exempt => narxdan qat'iye to'ovsiz; captcha test muhitida
      // o'fiq (TURNSTILE_SECRET_KEY bo'shatilgan), shuning uchun token shart emas.
      {
        const sendReq = (method: string, p: string, body?: any, token?: string) =>
          fetch(base + p, {
            method,
            headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
          });

        // 1) Ommaviy security: captcha o'fiq => sitekey null.
        const sec = await req('/api/settings/security');
        const secJson = await sec.json();
        assert(sec.status === 200 && secJson.turnstile_sitekey === null, 'draft: GET /api/settings/security → 200 + sitekey null (captcha off)');

        const phoneCat = await queryOne<any>("SELECT id, catalog_id FROM categories WHERE id = 'el_phone_mob'");
        const region = await queryOne<any>('SELECT id FROM regions LIMIT 1');
        const district = await queryOne<any>('SELECT id FROM districts LIMIT 1');
        if (phoneCat && region && district) {
          const baseFields = {
            catalog_id: phoneCat.catalog_id,
            type: 'SELL',
            category_id: phoneCat.id,
            region_id: region.id,
            district_id: district.id,
            price_type: 'FIXED',
            price_min: 3000000,
          };

          // 2) Qoralama yaratish (publish=false) — majburiy atribut (holat) yo'q, baribir 201.
          const draftRes = await sendReq('POST', '/api/listings', { ...baseFields, title: `Qora iPhone ${RUN_ID}`, description: 'qoralama tavsif', attributes: { brend: 'iPhone' }, publish: false }, adminToken);
          const draft = await draftRes.json();
          assert(draftRes.status === 201 && draft.status === 'DRAFT', 'draft: POST publish=false → 201 + status DRAFT (attr validatsiya yumshoq)');
          const draftId = draft.id as string;

          // 3) Qoralama not-ACTIVE: begubaga (USER, staff emas) ko'rinmaydi (404), egasiga (admin) ko'rinadi.
          const strangerView = await req(`/api/listings/${draftId}`, { headers: { authorization: `Bearer ${aliceToken}` } });
          assert(strangerView.status === 404, 'draft: non-owner GET /:id → 404 (DRAFT ommaga yopiq)');
          const ownerView = await req(`/api/listings/${draftId}`, { headers: { authorization: `Bearer ${adminToken}` } });
          assert(ownerView.status === 200, 'draft: owner GET /:id → 200');

          // 4) Qoralama qidiruvda chiqmaydi (searchListings status='ACTIVE' filtrlaydi).
          const searchRes = await req(`/api/listings?category_id=${phoneCat.id}&limit=50`);
          const searchArr = await searchRes.json();
          const items = Array.isArray(searchArr) ? searchArr : (searchArr.items || searchArr.listings || []);
          assert(!items.some((x: any) => x.id === draftId), 'draft: DRAFT listing excluded from public search');

          // 5) Joylash (publish) majburiy atribut (holat) yo'qligi sababli 400.
          const pubMissing = await sendReq('POST', `/api/listings/${draftId}/publish`, {}, adminToken);
          assert(pubMissing.status === 400, 'draft: publish with missing required attr → 400');

          // 6) Bog'liq (kaskad) atribut: brend=iPhone, model=Samsung modeli → 400.
          await sendReq('PUT', `/api/listings/${draftId}`, { attributes: { brend: 'iPhone', holat: 'Yangi', model: 'Galaxy S24' } }, adminToken);
          const pubBadDep = await sendReq('POST', `/api/listings/${draftId}/publish`, {}, adminToken);
          assert(pubBadDep.status === 400, 'draft: publish with dependent-model mismatch (iPhone→Galaxy) → 400');

          // 7) To'g'ri qiymatlar bilan joylash → 200 + ACTIVE.
          await sendReq('PUT', `/api/listings/${draftId}`, { attributes: { brend: 'iPhone', holat: 'Yangi', model: 'iPhone 15' } }, adminToken);
          const pubOk = await sendReq('POST', `/api/listings/${draftId}/publish`, {}, adminToken);
          const pubOkJson = await pubOk.json();
          assert(pubOk.status === 200 && pubOkJson.listing?.status === 'ACTIVE', 'draft: publish from draft with valid attrs → 200 + ACTIVE');

          // 8) Endi ochiq GET /:id 200 (ACTIVE).
          const publicView = await req(`/api/listings/${draftId}`);
          assert(publicView.status === 200, 'draft: after publish, public GET /:id → 200 (ACTIVE)');

          try { await runQuery('DELETE FROM listing_images WHERE listing_id = ?', [draftId]); } catch {}
          try { await runQuery('DELETE FROM listings WHERE id = ?', [draftId]); } catch {}
        } else {
          assert(false, 'draft: seeded el_phone_mob category + region + district available');
        }
      }

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
