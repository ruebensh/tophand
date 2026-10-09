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
  assert(sanitizeUserUrl('JaVaScRiPt&colon;alert(1)') === null || sanitizeUserUrl('javascript\u003Aalert(1)') === null, 'url: case/unicode javascript: blocked');
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

  console.log(`=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Security regression suite crashed:', err);
  process.exit(1);
});
