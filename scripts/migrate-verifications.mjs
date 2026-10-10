// ─── F-07: migrate old verification objects from the PUBLIC R2 bucket to the
// PRIVATE bucket (and optionally purge the old public copies).
//
// Ishlatish (.env'da R2 kalitlari + R2_PRIVATE_BUCKET_NAME to'liq bo'lishi shart):
//   node scripts/migrate-verifications.mjs            # dry-run (hech narsa o'chirmaydi)
//   node scripts/migrate-verifications.mjs --execute  # ko'chirish + public nusxani o'chirish
//
// Ko'chirish server-side (COPY) — byte'lar R2 ichida qoladi. Yangi obyektlar
// `Cache-Control: private, no-store` belgisi bilan yoziladi. Eski CDN/edge
// nusxalarini tozalash uchun script oxirida ko'rsatma beriladi.
import 'dotenv/config';
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

const REQUIRED = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PRIVATE_BUCKET_NAME'];
const missing = REQUIRED.filter((k) => !(process.env[k] || '').trim());
if (missing.length) {
  console.error(`Kamaytirilgan env: ${missing.join(', ')} (R2_PRIVATE_BUCKET_NAME — F-07 bo'yicha shart).`);
  process.exit(1);
}
if (process.env.R2_BUCKET_NAME === process.env.R2_PRIVATE_BUCKET_NAME) {
  console.error('R2_BUCKET_NAME va R2_PRIVATE_BUCKET_NAME bir xil — alohida YOPIQ bucket yarating (F-07).');
  process.exit(1);
}

const execute = process.argv.includes('--execute');
const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const SRC = process.env.R2_BUCKET_NAME;
const DST = process.env.R2_PRIVATE_BUCKET_NAME;
const PREFIX = 'verifications/';

// Yopiq bucket maqsadli (public read yo'q) ekanini tekshirish uchun URL so'raymiz.
try {
  await client.send(new HeadObjectCommand({ Bucket: DST, Key: `${PREFIX}.tophand-private-probe` }).catch(() => null));
} catch {
  /* probe ixtiyoriy */
}

let token;
let total = 0;
let copied = 0;
let deleted = 0;
const keys = [];
do {
  const list = await client.send(
    new ListObjectsV2Command({ Bucket: SRC, Prefix: PREFIX, ContinuationToken: token })
  );
  for (const obj of list.Contents || []) if (obj.Key) keys.push(obj.Key);
  token = list.NextContinuationToken;
} while (token);

total = keys.length;
console.log(`${SRC}/${PREFIX} ostida ${total} obyekt topildi. Rejim: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);

for (const key of keys) {
  if (!execute) {
    console.log(`  [dry] ${key} → ${DST}/${key}`);
    continue;
  }
  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: DST,
        Key: key,
        CopySource: encodeURIComponent(`${SRC}/${key}`),
        ContentType: 'image/webp',
        CacheControl: 'private, no-store, max-age=0',
        MetadataDirective: 'REPLACE',
      })
    );
    copied++;
    await client.send(new DeleteObjectCommand({ Bucket: SRC, Key: key }));
    deleted++;
    console.log(`  [ok] ${key} ko'chirildi va public nusxa o'chirildi`);
  } catch (err) {
    console.error(`  [fail] ${key}: ${err?.message || err}`);
  }
}

console.log(`\nYakun: jami ${total}, ko'chirildi ${copied}, public'dan o'chirildi ${deleted}.`);
console.log([
  '',
  '── QOLGAN QADAMLAR (Cloudflare panel — bu skript bajara olmaydi) ──────────',
  `1. ${DST} bucket'ida "Settings → R2 Dev Domain / Public read" O'CHIQ bo'lishini tekshiring (ommaviy CDN yo'q).`,
  '2. Eski public CDN/edge nusxalarini tozalang:',
  '   Cloudflare dashboard → Speed → Caching → Purge everything,',
  `   yoki aniq: curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone>/purge_cache" -H "Authorization: Bearer <token>" -d '{"files":["<R2_PUBLIC_URL>/verifications/..."]}'`,
  `3. Tasdiqlang: curl -I "${(process.env.R2_PUBLIC_URL || 'https://<public-domain>').replace(/\/$/, '')}/verifications/<istalgan-fayl>" → 403/404 bo'lishi KERAK.`,
  '4. Render env: R2_PRIVATE_BUCKET_NAME qo\'yilganini tekshiring (server shu bilan start oladi).',
].join('\n'));
