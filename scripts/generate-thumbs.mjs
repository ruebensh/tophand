// OPT: Eski e'lon rasmlari uchun 640px miniaturalarni bir marta qayta yasaydi.
//
// Shartnoma: serverdagi yangi yuklashlar `<id>.webp` bilan birga `<id>-t640.webp`
// ham yaratadi (storageService.processAndStoreImage). Bu skript shu nomlanish
// qoidasiga ko'ra MAVJUD bo'lmagan miniaturalarni to'ldiradi:
//   - `/uploads/<folder>/<file>.webp`  → lokal fayl (uploads/ papkasi)
//   - `/api/storage/<folder>/<file>` yoki R2_PUBLIC_URL/<folder>/<file> → R2 obyekti
//
// Ishlatish (loyiha ildizidan):
//   node scripts/generate-thumbs.mjs            # faqat hisobot (dry-run)
//   node scripts/generate-thumbs.mjs --write    # haqiqiy yozish
//
// DIQQAT: DATABASE_URL .env'dan olinadi — skript ulangan DB host'ini chop etadi;
// prod ma'lumotlar bazasiga urilishini o'zingiz nazorat qiling.
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import sharp from 'sharp';
import pg from 'pg';

dotenv.config();

const WRITE = process.argv.includes('--write');
const THUMB_RE = /-t640\.webp$/i;
const THUMB_MAX_PX = 640;
const THUMB_QUALITY = 70;

// ─── R2 (faqqat konfiguratsiya bo'lsa) ──────────────────────────────────────
const { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
const r2Enabled = Boolean(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_ENDPOINT &&
  process.env.R2_BUCKET_NAME
);
const r2 = r2Enabled
  ? new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null;
const BUCKET = process.env.R2_BUCKET_NAME || 'tophand-media';
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/$/, '') : '';
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// ─── URL → manzil (lokal path yoki R2 key) ──────────────────────────────────
function thumbKeyOf(key) {
  return key.replace(/\.webp$/i, '-t640.webp');
}

function isWebpKey(k) {
  return /\.webp$/i.test(k) && !/-t640\.webp$/i.test(k) && !k.includes('..');
}

function resolveSource(url, storageKey) {
  const clean = String(url || '').split('?')[0].split('#')[0];
  if (clean.startsWith('/uploads/') && /\.webp$/i.test(clean) && !THUMB_RE.test(clean)) {
    const key = clean.slice('/uploads/'.length);
    return { key, srcAbs: path.join(UPLOAD_DIR, key), thumbAbs: path.join(UPLOAD_DIR, thumbKeyOf(key)) };
  }
  let key = '';
  if (clean.startsWith('/api/storage/')) key = clean.slice('/api/storage/'.length);
  else if (R2_PUBLIC_BASE && clean.startsWith(R2_PUBLIC_BASE + '/')) key = clean.slice(R2_PUBLIC_BASE.length + 1);
  else if (isWebpKey(String(storageKey || ''))) key = String(storageKey);
  if (!isWebpKey(key) || !/\//.test(key)) return null;
  return { key, srcAbs: path.join(UPLOAD_DIR, key), thumbAbs: path.join(UPLOAD_DIR, thumbKeyOf(key)) };
}

// ─── Bitta obyekt bo'yicha ish ───────────────────────────────────────────────
// Manba avval LOKAL diskdan (uploads/<key>), topilmasa R2'dan izlanadi —
// chunki `listing_images` ikkala davrdagi yozuvlarni aralash saqlaydi.
async function ensureThumb(src) {
  if (fs.existsSync(src.thumbAbs)) return 'exists';
  if (fs.existsSync(src.srcAbs)) {
    const buf = await fs.promises.readFile(src.srcAbs);
    const thumb = await makeThumb(buf);
    if (!WRITE) return 'would-write';
    await fs.promises.mkdir(path.dirname(src.thumbAbs), { recursive: true });
    await fs.promises.writeFile(src.thumbAbs, thumb);
    return 'written';
  }
  if (!r2) return 'missing-original';
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: thumbKeyOf(src.key) }));
    return 'exists';
  } catch { /* yo'q — davom etamiz */ }
  let body;
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: src.key }));
    body = Buffer.from(await res.Body.transformToByteArray());
  } catch {
    return 'missing-original';
  }
  const thumb = await makeThumb(body);
  if (!WRITE) return 'would-write';
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: thumbKeyOf(src.key),
    Body: thumb,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return 'written';
}

async function makeThumb(buffer) {
  return sharp(buffer, { animated: false, failOn: 'error' })
    .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, effort: 4 })
    .toBuffer();
}

// ─── Asosiy oqim ─────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
});

function hostOf(url) {
  try { return new URL(url).host; } catch { return '(local/default)'; }
}
console.log(`DB: ${hostOf(process.env.DATABASE_URL)} | R2: ${r2 ? 'yoqilgan' : 'lokal rejim'} | rejim: ${WRITE ? 'YOZISH' : 'dry-run'}`);

const rows = await pool.query('SELECT url, storage_key FROM listing_images');

// Takrorlanuvchi URL'larni bir marta qayta ishlaymiz.
const jobs = new Map();
for (const row of rows.rows) {
  const src = resolveSource(row.url, row.storage_key);
  if (src) jobs.set(src.key, src);
}

const stats = { total: jobs.size, exists: 0, written: 0, wouldWrite: 0, missing: 0, failed: 0 };
const QUEUE = [...jobs.values()];
const WORKERS = 4; // sharp o'z navbatida CPU'ni band qiladi — kichik parallellik yetarli

async function worker() {
  for (;;) {
    const src = QUEUE.shift();
    if (!src) return;
    try {
      const result = await ensureThumb(src);
      if (result === 'exists') stats.exists++;
      else if (result === 'written') { stats.written++; console.log(`  + ${src.key}`); }
      else if (result === 'would-write') stats.wouldWrite++;
      else if (result === 'missing-original') stats.missing++;
    } catch (err) {
      stats.failed++;
      console.warn(`  ! ${src.key}: ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

console.log(
  `\nTayyor: ${stats.total} ta rasm | mavjud: ${stats.exists} | ${WRITE ? 'yozildi' : 'yoziladi (dry-run)'}: ${WRITE ? stats.written : stats.wouldWrite} | asl fayl yo'q: ${stats.missing} | xato: ${stats.failed}`
);
if (!WRITE && stats.wouldWrite > 0) console.log('Haqiqiy yozish uchun: node scripts/generate-thumbs.mjs --write');

await pool.end();
process.exit(0);
