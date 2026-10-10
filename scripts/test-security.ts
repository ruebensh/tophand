// ─── Security regression suite (commit-61 report, P2-6 / L-08) ──────────────
// Fast, DB-free checks for the guardrails that must NEVER silently regress:
//   1) URL sanitizer blocks XSS / protocol-relative / traversal vectors (M-06)
//   2) verification-media signed URLs fail closed without a secret, and the
//      HMAC binds owner + object key + expiry (P1-2 / P2-1)
//   3) image magic-byte sniffing accepts only real rasters, rejects SVG/HTML
//      disguised as images (P2-3)
//   4) INSECURE_ALLOWED is driven ONLY by LOCAL_DEV — NODE_ENV never unlocks
//      insecure behaviour (P1-3)
// Run: `npm test` (or `npx tsx scripts/test-security.ts`).
import dotenv from 'dotenv';
dotenv.config(); // deterministik: .env avval yuklanadi, keyin test o'zgartiradi

let passed = 0;
let failed = 0;
function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${name}`);
  }
}

// Cache-busted import: ESM moduli bir marta hisoblanadi, env o'zgargach yangi
// nusxa olish uchun ?q= parametr ishlatamiz (Node/tsx buni qo'llab-quvvatlaydi).
async function freshImport(base: string, q: number): Promise<any> {
  return import(`${base}?q=${q}`);
}

async function main() {
  console.log('=== TOPHAND SECURITY REGRESSION TESTS ===');

  // ── 1) URL sanitizer ──────────────────────────────────────────────────────
  const { sanitizeUserUrl, sanitizeUserUrlList } = await import('../server/lib/urlSecurity.ts');
  assert(sanitizeUserUrl('javascript:alert(1)') === null, 'url: javascript: blocked');
  // F-11: oldin `A || B` edi — bitta natija ikkinchisini yashirardi. Endi HAR
  // BIR input MUSTAQIL assertitsiya.
  assert(sanitizeUserUrl('JaVaScRiPt:alert(1)') === null, 'url: mixed-case javascript: blocked');
  assert(sanitizeUserUrl('javascript\u003Aalert(1)') === null, 'url: unicode-colon javascript: blocked');
  assert(sanitizeUserUrl('data:text/html;base64,PHN2Zz4=') === null, 'url: data: blocked');
  assert(sanitizeUserUrl('file:///etc/passwd') === null, 'url: file: blocked');
  assert(sanitizeUserUrl('//evil.example.com/x.png') === null, 'url: protocol-relative // blocked');
  assert(sanitizeUserUrl('/uploads/ok.png') === '/uploads/ok.png', 'url: same-origin relative path kept');
  assert(sanitizeUserUrl('/\\..\\secret') === null, 'url: backslash traversal blocked');
  assert(sanitizeUserUrl('https://example.com/a.png') === 'https://example.com/a.png', 'url: plain https URL kept');
  assert(sanitizeUserUrl('   ') === null && sanitizeUserUrl(undefined) === null, 'url: empty/non-string → null');
  assert(
    sanitizeUserUrlList(['javascript:x', 'https://ok.com/a.png', '/uploads/b.png', 42]).join('|') ===
      'https://ok.com/a.png|/uploads/b.png',
    'url: list sanitizer drops invalid entries'
  );

  // ── 2) Signed verification-media URLs ─────────────────────────────────────
  // 2a) Fail-closed: no secret → signing disabled, no URL issued.
  // (Bundan keyin yuklanadigan modullar dotenv.config() qayta chaqirishi mumkin,
  // lekin JWT_SECRET endi test qo'ygan qiymatda qoladi — dotenv mavjud env'ni
  // bossa olmaydi.)
  delete process.env.VERIFICATION_MEDIA_SECRET;
  delete process.env.JWT_SECRET;
  const disabled = await import('../server/lib/signedUrl.ts');
  assert(disabled.MEDIA_SIGNING_ENABLED === false, 'sign: disabled without a secret (fail-closed)');
  assert(disabled.signVerificationPhotoUrl('file.webp', 'usr_1') === null, 'sign: no URL when signing disabled');
  assert(disabled.verifyVerificationPhotoSig('file.webp', 'usr_1', Math.floor(Date.now() / 1000) + 60, 'x'.repeat(64)) === false, 'verify: rejects when signing disabled');

  // 2b) With a secret: owner-bound payload, expiry + tamper checks.
  process.env.JWT_SECRET = 'regression-test-secret-0123456789abcdef';
  const signed = await freshImport('../server/lib/signedUrl.ts', 1);
  assert(signed.MEDIA_SIGNING_ENABLED === true, 'sign: enabled when JWT_SECRET present (fallback chain)');
  const url = signed.signVerificationPhotoUrl('doc-a.webp', 'usr_alice');
  assert(typeof url === 'string' && url.startsWith('/api/verification-photo/doc-a.webp?uid=usr_alice&exp='), 'sign: URL encodes object key + owner uid + expiry');
  const q = new URL(url, 'http://localhost').searchParams;
  const exp = Number(q.get('exp'));
  const sig = q.get('sig') || '';
  assert(signed.verifyVerificationPhotoSig('doc-a.webp', 'usr_alice', exp, sig) === true, 'verify: valid owner+key+exp+sig passes');
  assert(signed.verifyVerificationPhotoSig('doc-a.webp', 'usr_bob', exp, sig) === false, 'verify: other user rejected (payload binds owner)');
  assert(signed.verifyVerificationPhotoSig('doc-b.webp', 'usr_alice', exp, sig) === false, 'verify: different object key rejected');
  assert(signed.verifyVerificationPhotoSig('doc-a.webp', 'usr_alice', exp - 3600, sig) === false, 'verify: tampered expiry rejected');
  assert(signed.verifyVerificationPhotoSig('doc-a.webp', 'usr_alice', Math.floor(Date.now() / 1000) - 10, sig) === false, 'verify: expired link rejected');
  assert(signed.verifyVerificationPhotoSig('doc-a.webp', 'usr_alice', exp, '0'.repeat(sig.length)) === false, 'verify: wrong signature rejected');

  // ── 3) Image magic-byte sniffing ──────────────────────────────────────────
  const { sniffImageSignature } = await import('../server/services/storageService.ts');
  const mk = (bytes: number[], pad = 16) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(pad)]);
  assert(sniffImageSignature(mk([0xff, 0xd8, 0xff, 0xe0])), 'magic: JPEG accepted');
  assert(sniffImageSignature(mk([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'magic: PNG accepted');
  assert(sniffImageSignature(mk([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), 'magic: GIF accepted');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);
  assert(sniffImageSignature(webp), 'magic: WebP accepted');
  assert(!sniffImageSignature(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), 'magic: SVG rejected');
  assert(!sniffImageSignature(Buffer.from('%PDF-1.4 fake')), 'magic: PDF rejected');
  assert(!sniffImageSignature(Buffer.from('not an image at all')), 'magic: plain text rejected');
  assert(!sniffImageSignature(Buffer.alloc(4)), 'magic: truncated buffer rejected');

  // ── 4) INSECURE_ALLOWED gating ────────────────────────────────────────────
  delete process.env.LOCAL_DEV;
  process.env.NODE_ENV = 'development';
  const gate = await freshImport('../server/lib/envSecurity.ts', 1);
  assert(gate.LOCAL_DEV === false, 'gate: NODE_ENV=development alone does NOT set LOCAL_DEV');
  assert(gate.INSECURE_ALLOWED === false, 'gate: INSECURE_ALLOWED false without LOCAL_DEV=1 (fail-closed)');
  assert(gate.EXPOSED === true, 'gate: EXPOSED true in a NODE_ENV=development but LOCAL_DEV-unset run');

  // ── 5) serverError: 5xx LOCAL_DEV=1 da ham leak qilmaydi (F-10) ──────────
  {
    const { serverError } = await import('../server/lib/error.ts');
    let captured: any = null;
    const fakeRes: any = {
      status() {
        return this;
      },
      json(body: any) {
        captured = body;
      },
      headersSent: false,
    };
    serverError(fakeRes, Object.assign(new Error('insert into "users" ... duplicate key 23505'), { status: 500 }), 'Generic');
    assert(captured?.error === 'Generic', 'err: 5xx message hidden even outside EXPOSED (F-10)');
    serverError(fakeRes, Object.assign(new Error('Email band'), { status: 400 }));
    assert(captured?.error === 'Email band', 'err: intentional 4xx message preserved');
  }

  // ── 6) F-04: semaphore slot timeout'dan keyin ham BAND qoladi ─────────────
  {
    const mod = await import('../server/services/storageService.ts');
    const { withImageSlot, IMAGE_SEMAPHORE_LIMITS } = mod;
    const limit = IMAGE_SEMAPHORE_LIMITS.MAX_CONCURRENT;
    let releaseNative: () => void = () => {};
    // native ish SHARTLI ravishda uzoq davom etadi — faqat qo'lda (releaseNative)
    // settle bo'ladi. Bu Sharp/libvips'ning "haqiqiy ishi tugaguncha" modelini
    // taqlid qiladi (wrapper timeout uni to'xtatmaydi).
    const nativeBlocker = new Promise<void>((resolve) => { releaseNative = resolve; });
    // Wrapper (mijoz) timeout QISQA (20ms): mijoz javobni oladi, lekin native
    // hanuz ishlamoqda → slot bo'shatilmaydi.
    const running = Array.from({ length: limit }, () =>
      withImageSlot(() => nativeBlocker, { ms: 20, label: 'test-timeout' })
    );
    await Promise.allSettled(running);
    assert(IMAGE_SEMAPHORE_LIMITS.active() === limit, 'sem: slots stay held after wrapper timeout (native work not settled)');
    // Barcha slot band → keyingi ish navbatga tushadi (darhol 503 EMAS, navbat
    // bo'sh — bu to'g'ri), native settle bo'lgachгина ishga kirishadi.
    let queuedResolved = false;
    const queued = withImageSlot(async () => {
      queuedResolved = true;
      return 'ok';
    }, { ms: 2000, label: 'queued' }).catch(() => '503');
    await new Promise((r) => setTimeout(r, 30));
    assert(!queuedResolved, 'sem: new pipeline does NOT start while all native slots are busy');
    releaseNative();
    assert((await queued) === 'ok', 'sem: queued work starts only after a native job truly settles');
  }

  // ── 7) F-05: video container parser ──────────────────────────────────────
  {
    const { parseVideoSafe } = await import('../server/lib/videoSecurity.ts');
    const mkMp4Box = (type: string, payload: Buffer): Buffer => {
      const size = Buffer.alloc(4);
      size.writeUInt32BE(8 + payload.length);
      return Buffer.concat([size, Buffer.from(type, 'latin1'), payload]);
    };
    const mvhd = (dur: number) => {
      const p = Buffer.alloc(96);
      p.writeUInt32BE(1000, 12); // timescale
      p.writeUInt32BE(dur, 16); // duration
      return p;
    };
    const trak = (codec: string, w = 640, h = 480): Buffer => {
      const stsdEntry = Buffer.concat([Buffer.from(codec, 'latin1'), Buffer.alloc(78)]);
      const stsdPayload = Buffer.concat([Buffer.alloc(8), Buffer.alloc(4), stsdEntry]);
      const stbl = mkMp4Box('stbl', mkMp4Box('stsd', stsdPayload));
      const minf = mkMp4Box('minf', stbl);
      const mdia = mkMp4Box('mdia', Buffer.concat([mkMp4Box('hdlr', Buffer.concat([Buffer.alloc(8), Buffer.from('vide'), Buffer.alloc(20)])), minf]));
      const tkhdPayload = Buffer.alloc(84);
      const tkhd = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.alloc(76), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(w << 16); return b; })(), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(h << 16); return b; })()]);
      void tkhdPayload;
      return mkMp4Box('trak', Buffer.concat([mkMp4Box('tkhd', tkhd), mdia]));
    };
    const buildMp4 = (opts: { codec?: string; duration?: number; brand?: string; dims?: [number, number] }) => {
      const brand = opts.brand || 'isom';
      const ftyp = mkMp4Box('ftyp', Buffer.concat([Buffer.from(brand, 'latin1'), Buffer.alloc(4), Buffer.from(brand, 'latin1')]));
      const dims = opts.dims || [640, 480];
      const moov = mkMp4Box('moov', Buffer.concat([
        mkMp4Box('mvhd', mvhd(opts.duration ?? 5000)),
        trak(opts.codec ?? 'avc1', dims[0], dims[1]),
      ]));
      const mdat = mkMp4Box('mdat', Buffer.alloc(2048));
      return Buffer.concat([ftyp, moov, mdat, Buffer.alloc(2048)]);
    };
    const validMp4 = buildMp4({});
    assert(parseVideoSafe(validMp4).container === 'mp4', 'video: valid MP4 fixture accepted');
    assert(parseVideoSafe(buildMp4({ codec: 'av01' })).codec === 'av01', 'video: AV1 in MP4 accepted');

    // Build a minimal but STRUCTURALLY VALID WebM (EBML) to guard the keep-marker ID path.
    const ebml = (id: number[], payload: Buffer): Buffer => {
      const idBuf = Buffer.from(id);
      let sizeBuf: Buffer;
      if (payload.length < 128) sizeBuf = Buffer.from([0x80 | payload.length]);
      else { const b = Buffer.alloc(2); b.writeUInt16BE(0x4000 | payload.length); sizeBuf = b; }
      return Buffer.concat([idBuf, sizeBuf, payload]);
    };
    const u32be = (n: number): Buffer => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
    const buildWebm = (durMs: number, w: number, h: number): Buffer => {
      const fp = Buffer.alloc(8); fp.writeDoubleBE(durMs, 0);
      const header = ebml([0x1a, 0x45, 0xdf, 0xa3], ebml([0x42, 0x82], Buffer.from('webm', 'ascii')));
      const info = ebml([0x15, 0x49, 0xa9, 0x66], ebml([0x44, 0x89], fp));
      const video = ebml([0xe0], Buffer.concat([ebml([0xb0], u32be(w)), ebml([0xba], u32be(h))]));
      const tracks = ebml([0x16, 0x54, 0xae, 0x6b], ebml([0xae], video));
      const segment = ebml([0x18, 0x53, 0x80, 0x67], Buffer.concat([info, tracks]));
      return Buffer.concat([header, segment, Buffer.alloc(2048)]); // pad past 1024 min
    };
    const validWebm = buildWebm(5000, 640, 480);
    const webmInfo = parseVideoSafe(validWebm);
    assert(webmInfo.container === 'webm', 'video: valid WebM fixture accepted');
    assert(webmInfo.width === 640 && webmInfo.height === 480, 'video: WebM dimensions parsed');
    assert(Math.abs(webmInfo.durationSec - 5) < 0.01, 'video: WebM duration parsed');
    let threw = false;

    try { parseVideoSafe(Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from('ftypisom'), Buffer.alloc(8, 1), Buffer.alloc(2048)])); } catch { threw = true; }
    assert(threw, 'video: forged ftyp signature + random body rejected');
    threw = false;
    try { parseVideoSafe(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(4), Buffer.from([0x81]), Buffer.from([0x44]), Buffer.alloc(2048)])); } catch { threw = true; }
    assert(threw, 'video: EBML prefix + garbage rejected');
    threw = false;
    try { parseVideoSafe(buildMp4({ brand: 'qt  ' })); } catch { threw = true; }
    assert(threw, 'video: non-allowlisted mp4 brand rejected');
    threw = false;
    try { parseVideoSafe(buildMp4({ duration: 30 * 60 * 1000 })); } catch { threw = true; }
    assert(threw, 'video: over-long duration rejected');
    threw = false;
    try { parseVideoSafe(buildMp4({ dims: [5120, 2880] })); } catch { threw = true; }
    assert(threw, 'video: over-max dimensions rejected');
    threw = false;
    try { parseVideoSafe(Buffer.concat([Buffer.from([0, 0, 0, 8]), Buffer.from('junk'), Buffer.alloc(2048)])); } catch { threw = true; }
    assert(threw, 'video: no moov rejected');
    threw = false;
    try { parseVideoSafe(Buffer.alloc(64)); } catch { threw = true; }
    assert(threw, 'video: tiny file rejected');

    // Regressiya (mvhd): taratilgan/qisqa mvhd avval xom RangeError → 500
    // berardi; endi parseVideoSafe uni status=400 VideoRejected'ga aylantiradi.
    {
      const badMvhd = mkMp4Box('moov', Buffer.concat([
        mkMp4Box('mvhd', Buffer.alloc(6)), // version o'qiladi, duration uchib ketadi
        trak('avc1', 640, 480),
      ]));
      const ftyp2 = mkMp4Box('ftyp', Buffer.concat([Buffer.from('isom', 'latin1'), Buffer.alloc(4), Buffer.from('isom', 'latin1')]));
      let vidErr: any = null;
      try { parseVideoSafe(Buffer.concat([ftyp2, badMvhd, Buffer.alloc(2048)])); } catch (e) { vidErr = e; }
      assert(vidErr !== null && vidErr.status === 400, 'video: truncated mvhd → controlled 400 (not 500)');
    }
  }

  // ── 8) F-06: processAndStoreImage ichida reserved folder (case-insensitive) ─
  {
    const { processAndStoreImage } = await import('../server/services/storageService.ts');
    const jpegHeader = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
    for (const bad of ['VERIFICATIONS', 'Verifications', 'verifications/']) {
      let status = 0;
      await processAndStoreImage(jpegHeader, bad).catch((e: any) => {
        status = e?.status || 0;
      });
      assert(status === 400, `folder: "${bad}" rejected inside processAndStoreImage (F-06)`);
    }
  }

  // ── 9) F-03: trust proxy konfiguratsiyasi ─────────────────────────────────
  {
    const { resolveTrustProxy } = await import('../server/lib/rateLimit.ts');
    assert(resolveTrustProxy(undefined) === 1, 'proxy: default 1 (single trusted proxy)');
    assert(resolveTrustProxy('0') === false, 'proxy: 0 → headers not trusted (direct exposure)');
    assert(resolveTrustProxy('direct') === false, 'proxy: "direct" → headers not trusted');
    assert(resolveTrustProxy('2') === 2, 'proxy: numeric hop count passed through');
    assert(resolveTrustProxy('10.0.0.0/8') === '10.0.0.0/8', 'proxy: CIDR string passed to Express');
  }

  // ── 10) F-01: limiter identity faqat IP/tasdiqlangan userId'ga bog'liq ──────
  {
    const { buildRateLimit, memoryStore } = await import('../server/lib/rateLimit.ts');
    const store = memoryStore();
    const limiter = buildRateLimit({
      windowMs: 60_000,
      max: 10,
      scope: '/api/auth/register/send-code',
      message: '429',
      identity: (req: any) => `ip:${req.ip}`,
      store,
    });
    const mkRes = () => ({
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      status(code: number) { (this as any).statusCode = code; return this; },
      json(body: any) { (this as any).body = body; return this; },
    });
    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const res: any = mkRes();
      let passed = false;
      // Har so'rovda BUTUNLAY boshqa Authorization + boshqa path — eski dizaynda
      // 12 ta alohida bucket bo'lar edi; endi faqat IP hisoblanadi.
      await limiter(
        { ip: '203.0.113.7', headers: { authorization: `Bearer forger-${i}-${Math.random()}` }, path: `/x${i}` } as any,
        res,
        () => { passed = true; }
      );
      lastStatus = res.statusCode || (passed ? 200 : 0);
    }
    assert(lastStatus === 429, 'limit: arbitrary bearer/path changes do NOT reset the bucket (F-01)');
    assert(store.size() === 1, 'limit: exactly ONE bucket for 12 varying-header requests');
    // Bounded store: maxKeys chegarasi ishlaydi
    const bounded = memoryStore();
    for (let i = 0; i < 5; i++) await bounded.incr(`k${i}`, 60_000, 3);
    assert(bounded.size() <= 3, 'limit: store evicts beyond maxKeys (bounded memory)');

    // Report #10: store xatosida DEFAULT fail-CLOSED (429); failOpen:true bo'lsa o'tadi.
    const throwingStore = { incr: () => Promise.reject(new Error('redis down')) };
    const mkRes2 = () => ({
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string) { this.headers[k] = v; },
      status(code: number) { (this as any).statusCode = code; return this; },
      json(body: any) { (this as any).body = body; return this; },
    });
    const closedLimiter = buildRateLimit({
      windowMs: 60_000, max: 10, scope: '/api/x', message: '429',
      identity: (rq: any) => `ip:${rq.ip}`, store: throwingStore,
    });
    const cres: any = mkRes2();
    let cPassed = false;
    await closedLimiter({ ip: '1.2.3.4' } as any, cres, () => { cPassed = true; });
    assert(cres.statusCode === 429 && !cPassed, 'limit: store error → FAIL-CLOSED (429), not bypassed (report #10)');
    const openLimiter = buildRateLimit({
      windowMs: 60_000, max: 10, scope: '/api/x', message: '429',
      identity: (rq: any) => `ip:${rq.ip}`, store: throwingStore, failOpen: true,
    });
    const ores: any = mkRes2();
    let oPassed = false;
    await openLimiter({ ip: '1.2.3.4' } as any, ores, () => { oPassed = true; });
    assert(oPassed && !(ores as any).statusCode, 'limit: failOpen:true opt-in still passes on store error');

    // Report #10: eviction picks MIN-RESET (tezroq o'ladigan) bucket'ni,
    // insertion-order emas. `a` eski lekin reset'i KECH (jonli), `b`/`c` reset'i
    // ERTA — to'lganda near-expiry biri chiqarib tashlanadi, `a` qoladi.
    const ev = memoryStore();
    await ev.incr('a', 10_000_000, 2); // a: reset juda uzoq
    await ev.incr('b', 60_000, 2);     // b: reset yaqin
    await ev.incr('c', 60_000, 2);     // sig'maydi → evict (b yoki c ketadi)
    assert(ev.size() === 2, 'limit: bounded eviction keeps size at maxKeys');
    const aRec = await ev.incr('a', 10_000_000, 2); // a hali ichida → count 2
    assert(aRec!.count === 2, 'limit: min-reset eviction keeps the long-lived (active) bucket (report #10)');
  }

  console.log(`=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Security regression suite crashed:', err);
  process.exit(1);
});
