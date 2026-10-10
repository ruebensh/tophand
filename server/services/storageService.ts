import dotenv from 'dotenv';
dotenv.config();

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { EXPOSED } from '../lib/envSecurity.ts';
import { parseVideoSafe } from '../lib/videoSecurity.ts';
import { enqueueDeletion } from './mediaDeletionQueue.ts';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// SECURITY (H-06): `folder` is partly caller-controlled (upload query param and
// R2 object prefix). A raw value like `../../etc` would escape UPLOAD_DIR via
// path.join and allow arbitrary file writes. We accept ONLY a single safe path
// segment here and, for local writes, additionally assert containment under
// UPLOAD_DIR so nothing can ever be written outside it.
const SAFE_FOLDER_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

// SECURITY (M-04 / P2-2): resource-exhaustion / decompression-bomb guards for the
// image decoder. We bound total input pixels, per-side dimensions, disable
// animated multi-frame decoding, fail on any corrupt pixel data, and cap
// decode/encode wall-clock time so a hostile image can't pin the event loop or
// exhaust RAM. Listing images resize down to 1280px, so a 20MP / 6000px per-side
// input ceiling is far above any legitimate photo while curbing 40MP bursts.
const MAX_INPUT_PIXELS = 20_000_000; // ~20MP total (P2-2: lowered from 40MP)
const MAX_INPUT_DIM = 6_000;         // max any single side (px) (P2-2: 10k → 6k)
const DECODE_TIMEOUT_MS = 20_000;    // hard cap for one image pipeline
// P2-2: bound how many native Sharp/libvips decodes run at once. A promise
// timeout alone does NOT cancel libvips work, so parallel hostile uploads could
// still pile up CPU/RAM after their responses have "timed out". A hard semaphore
// caps concurrency; the queue is capped too, and over-cap requests fail fast
// (503) instead of growing memory without bound.
const MAX_CONCURRENT_IMAGE_PIPELINES = 2;
const MAX_IMAGE_QUEUE = 24;
const SHARP_INPUT_OPTS = {
  limitInputPixels: MAX_INPUT_PIXELS,
  failOn: 'error' as const,
  animated: false,
};

// Simple async counting semaphore with a bounded wait queue.
let activeImagePipelines = 0;
const imageWaiters: Array<() => void> = [];

// F-04 regression hooks (scripts/test-security.ts): timeout'dan keyin ham slot
// native ish settle bo'lguncha band qolishini tekshirish uchun.
export const IMAGE_SEMAPHORE_LIMITS = {
  MAX_CONCURRENT: MAX_CONCURRENT_IMAGE_PIPELINES,
  MAX_QUEUE: MAX_IMAGE_QUEUE,
  active: () => activeImagePipelines,
  waiting: () => imageWaiters.length,
};
/** @internal faqat testlar uchun eksport qilingan. */
export { withImageSlot };
async function acquireImageSlot(): Promise<void> {
  if (activeImagePipelines < MAX_CONCURRENT_IMAGE_PIPELINES) {
    activeImagePipelines++;
    return;
  }
  if (imageWaiters.length >= MAX_IMAGE_QUEUE) {
    throw Object.assign(new Error('Rasm yuklari navbati to‘lgan — birozdan so‘ng qayta urinib ko‘ring'), { status: 503 });
  }
  await new Promise<void>((resolve) => imageWaiters.push(resolve));
  activeImagePipelines++;
}
function releaseImageSlot(): void {
  activeImagePipelines--;
  const next = imageWaiters.shift();
  if (next) next();
}
// F-04: Sharp/libvips ish HAQIQI cancel bo'lmaydi (promise timeout native'tni
// to'xtatmaydi). Xavfsiz yechim — slot'ni FAQAT native ish (fn) haqiqiy settle
// bo'lgach qaytarish. Mijozga timeout javobini erta qaytarsak ham slot band
// qoladi, shunda parallel native pipeline'lar soni konfiguratsiya chegarasidan
// HECH qachon oshmaydi (timeout'li so'rov slot'ni "olib qocholmaydi" va
// keyingi navbatni ochib bosa olmaydi).
async function withImageSlot<T>(
  fn: () => Promise<T>,
  timeout?: { ms: number; label: string }
): Promise<T> {
  await acquireImageSlot();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    releaseImageSlot();
  };
  const native = fn();
  // Slot release native settle'ga bog'liq — caller timeout'iga emas.
  // (Ikkala handler ham berilgan: reject unhandled bo'lib qolmasligi uchun.)
  native.then(release, release);
  return timeout ? withTimeout(native, timeout.ms, timeout.label) : native;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}: ishlov tugash vaqti oshdi (timeout)`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// Reject obviously absurd dimensions before we let Sharp decode the full image.
function assertSafeDimensions(meta: { width?: number; height?: number }): void {
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w > MAX_INPUT_DIM || h > MAX_INPUT_DIM || w * h > MAX_INPUT_PIXELS) {
    throw Object.assign(new Error("Rasm o'lchami juda katta (ruxsat etilgan maksimum ~20MP)"), { status: 400 });
  }
}

// SECURITY (P2-3): real image-format magic-byte check. Accept ONLY the raster
// formats the product needs (JPEG/PNG/GIF/WebP). SVG, SVGZ, HTML or plain text
// files masquerading as images are rejected BEFORE Sharp parses them.
// Exported for the security regression suite (scripts/test-security.ts).
export function sniffImageSignature(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF: 'GIF87a' / 'GIF89a'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WEBP: 'RIFF' .... 'WEBP'
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  return false;
}
function assertSafeImageMagic(buf: Buffer): void {
  if (!sniffImageSignature(buf)) {
    throw Object.assign(new Error('Fayl haqiqiy rasm emas (faqat JPEG, PNG, GIF yoki WebP qabul qilinadi)'), { status: 400 });
  }
}
function sanitizeFolder(folder: string | undefined, fallback: string): string {
  const value = (folder || '').trim().toLowerCase();
  if (!value) return fallback;
  if (!SAFE_FOLDER_RE.test(value)) {
    throw Object.assign(new Error('Noto‘g‘ri yuklash katalogi (faqat harf, raqam, _ va - ruxsat)'), { status: 400 });
  }
  // F-06: RESERVED papkalar — generic img/video pipeline VERIFICATION obyektlar
  // papkasiga yozmasligi kerak. Route'dan qat'iy, shu yerda ham (har bir
  // kelajakdagi chaqiruvchi uchun) va CASE-INSENSITIVE (normalize qilingan
  // qiymatda) tekshiriladi.
  if (value === VERIFICATION_FOLDER) {
    throw Object.assign(new Error('Tasdiq rasmi uchun /api/users/me/verification/upload ishlatiladi'), { status: 400 });
  }
  return value;
}

// Resolve `folder` to an absolute dir and guarantee it stays inside UPLOAD_DIR.
function resolveUploadDir(folder: string): string {
  const dir = path.resolve(UPLOAD_DIR, folder);
  const withSep = UPLOAD_DIR.endsWith(path.sep) ? UPLOAD_DIR : UPLOAD_DIR + path.sep;
  if (dir !== UPLOAD_DIR && !dir.startsWith(withSep)) {
    throw Object.assign(new Error('Yuklash katalogi chegaradan tashqarida'), { status: 400 });
  }
  return dir;
}

// ─── Cloudflare R2 Client Setup ──────────────────────────────────────────
const isR2Enabled = Boolean(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_ENDPOINT &&
  process.env.R2_BUCKET_NAME
);

export const r2Client = isR2Enabled
  ? new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tophand-media';

// SECURITY (P1-1 / F-07): verification passport/selfie images are personal data.
// They are stored ONLY in a DEDICATED PRIVATE bucket (`R2_PRIVATE_BUCKET_NAME`)
// under the `verifications/` prefix. There is NO fallback to the main/public
// bucket: if R2 is enabled and the private bucket is not configured, the whole
// server refuses to start in an exposed env (see REQUIRES_PRIVATE_BUCKET_CHECK()
// below, enforced in server.ts) and each verification write fails closed.
// NOTE (infra): the private bucket must have NO public read and NO CDN/public
// domain mapping. Verify with: curl -I https://pub-.../verifications/<any-file>
// → 403. Old objects must be migrated: scripts/migrate-verifications.mjs.
export const VERIFICATION_FOLDER = 'verifications';
const PRIVATE_BUCKET_NAME = (process.env.R2_PRIVATE_BUCKET_NAME || '').trim();

/**
 * F-07 startup guard: R2 yoqilgan va internetga ochiq muhitda, lekin yopiq
 * bucket sozlanmagan — TRUE (server ishga tushmasligi kerak). Lokal disk
 * rejimida (R2 yo'q) xavfsiz: fayllar `uploads/verifications`'da saqlanadi va
 * statik `/uploads/verifications` route to'liq 404 qaytaradi.
 */
export function REQUIRES_PRIVATE_BUCKET_CHECK(): boolean {
  return EXPOSED && isR2Enabled && !PRIVATE_BUCKET_NAME;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  width?: number;
  height?: number;
  mimetype: string;
  storage: 'r2' | 'local';
}

/**
 * Optimizes an image (resize + WebP conversion) and stores it in Cloudflare R2 or local disk.
 */
export async function processAndStoreImage(
  inputBuffer: Buffer,
  folder: string = 'photos',
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<UploadResult> {
  const { maxWidth = 1280, maxHeight = 1280, quality = 82 } = options;
  folder = sanitizeFolder(folder, 'photos');
  // P2-3: verify the REAL raster signature before touching the decoder. Client
  // MIME is untrusted; this also rejects SVG/SVGZ/HTML/text masquerading as an
  // image (Sharp would otherwise rasterize SVG via libxml — an XXE/bomb vector).
  assertSafeImageMagic(inputBuffer);

  // 1. Optimize image using Sharp: convert to WebP, resize if large, keep aspect
  //    ratio. The whole decode (metadata + re-encode) runs inside a bounded
  //    concurrency slot and a wall-clock deadline (P2-2).
  const processedBuffer = await withImageSlot(async () => {
    const metadata = await sharp(inputBuffer, SHARP_INPUT_OPTS).rotate().metadata();
    assertSafeDimensions(metadata);
    return sharp(inputBuffer, SHARP_INPUT_OPTS)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();
  }, { ms: DECODE_TIMEOUT_MS, label: 'Rasm ishlov' });

  const processedMeta = await sharp(processedBuffer).metadata();
  const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const filename = `${uniqueId}.webp`;
  const storageKey = `${folder}/${filename}`;

  // 2. Upload to Cloudflare R2 if configured
  if (r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: processedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${storageKey}`
      : `/api/storage/${storageKey}`;

    return {
      url: publicUrl,
      key: storageKey,
      size: processedBuffer.length,
      width: processedMeta.width,
      height: processedMeta.height,
      mimetype: 'image/webp',
      storage: 'r2',
    };
  }

  // 3. Fallback: Save to local uploads folder
  const targetDir = resolveUploadDir(folder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const localFilePath = path.join(targetDir, filename);
  await fs.promises.writeFile(localFilePath, processedBuffer);

  return {
    url: `/uploads/${folder}/${filename}`,
    key: storageKey,
    size: processedBuffer.length,
    width: processedMeta.width,
    height: processedMeta.height,
    mimetype: 'image/webp',
    storage: 'local',
  };
}

/**
 * Optimizes and stores platform logo image (PNG/WebP with transparency preserved).
 */
export async function processAndStoreLogo(
  inputBuffer: Buffer,
  originalFilename?: string
): Promise<UploadResult> {
  // Resize logo if overly huge (e.g. > 1024px) but preserve transparency. Bounded
  // concurrency + deadline (P2-2), metadata inside the deadline.
  const processedBuffer = await withImageSlot(async () => {
    const metadata = await sharp(inputBuffer, SHARP_INPUT_OPTS).rotate().metadata();
    assertSafeDimensions(metadata);
    return sharp(inputBuffer, SHARP_INPUT_OPTS)
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ quality: 90, compressionLevel: 8 })
      .toBuffer();
  }, { ms: DECODE_TIMEOUT_MS, label: 'Logo ishlov' });

  const processedMeta = await sharp(processedBuffer).metadata();
  const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const filename = `tophand-logo-${uniqueId}.png`;
  const storageKey = `logo/${filename}`;

  if (r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: processedBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${storageKey}`
      : `/api/storage/${storageKey}`;

    return {
      url: publicUrl,
      key: storageKey,
      size: processedBuffer.length,
      width: processedMeta.width,
      height: processedMeta.height,
      mimetype: 'image/png',
      storage: 'r2',
    };
  }

  // Local fallback
  const logoDir = path.join(UPLOAD_DIR, 'logo');
  if (!fs.existsSync(logoDir)) {
    fs.mkdirSync(logoDir, { recursive: true });
  }

  const localPath = path.join(logoDir, filename);
  await fs.promises.writeFile(localPath, processedBuffer);

  return {
    url: `/uploads/logo/${filename}`,
    key: storageKey,
    size: processedBuffer.length,
    width: processedMeta.width,
    height: processedMeta.height,
    mimetype: 'image/png',
    storage: 'local',
  };
}

/**
 * Optimizes and stores a favicon PNG (transparency preserved) under the `favicon/` folder.
 * `variant` is 'light' (for light browser/tab background) or 'dark' (for dark background).
 * Separate from the site logo — the favicon is its own asset.
 */
export async function processAndStoreFavicon(
  inputBuffer: Buffer,
  variant: 'light' | 'dark'
): Promise<UploadResult> {
  const processedBuffer = await withImageSlot(
    () =>
      sharp(inputBuffer, SHARP_INPUT_OPTS)
        .rotate()
        .resize({
          width: 512,
          height: 512,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    { ms: DECODE_TIMEOUT_MS, label: 'Favicon ishlov' }
  );

  const processedMeta = await sharp(processedBuffer).metadata();
  const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const filename = `favicon-${variant}-${uniqueId}.png`;
  const storageKey = `favicon/${filename}`;

  if (r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: processedBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${storageKey}`
      : `/api/storage/${storageKey}`;

    return {
      url: publicUrl,
      key: storageKey,
      size: processedBuffer.length,
      width: processedMeta.width,
      height: processedMeta.height,
      mimetype: 'image/png',
      storage: 'r2',
    };
  }

  // Local fallback
  const faviconDir = path.join(UPLOAD_DIR, 'favicon');
  if (!fs.existsSync(faviconDir)) {
    fs.mkdirSync(faviconDir, { recursive: true });
  }

  const localPath = path.join(faviconDir, filename);
  await fs.promises.writeFile(localPath, processedBuffer);

  return {
    url: `/uploads/favicon/${filename}`,
    key: storageKey,
    size: processedBuffer.length,
    width: processedMeta.width,
    height: processedMeta.height,
    mimetype: 'image/png',
    storage: 'local',
  };
}

/**
 * Stores a raw video file (mp4/webm) in Cloudflare R2 or local disk.
 * Faza 13 — video media for listings.
 */
/**
 * Video faylning HAQIQI turini magic-byte (imzo) orqali aniqlaymiz — mijoz
 * yuborgan mimetype'ga ishonmaymiz (H-05/M-05: soxta rasm/video yuklash).
 * MP4 → offset 4 da 'ftyp'; WebM/MKV → offset 0 da EBML `1A 45 DF A3`.
 * F-05: imzo faqat BIRINCHI qadam — storeVideo bundan tashqari to'liq
 * container parser (server/lib/videoSecurity.ts) orqali kodex/davomiylik/size
 * tekshiruvini o'tkazadi va yaroqsiz faylni SAQLAMAYDI.
 */
function sniffVideoSignature(buf: Buffer): { ext: string; contentType: string } | null {
  if (buf.length < 12) return null;
  // ISO-BMFF / MP4: baytlar 4..8 == "ftyp"
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return { ext: 'mp4', contentType: 'video/mp4' };
  }
  // Matroska/WebM EBML header: 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { ext: 'webm', contentType: 'video/webm' };
  }
  return null;
}

export async function storeVideo(
  inputBuffer: Buffer,
  mimetype: string,
  folder: string = 'videos'
): Promise<UploadResult> {
  folder = sanitizeFolder(folder, 'videos');
  const sniffed = sniffVideoSignature(inputBuffer);
  if (!sniffed) {
    throw Object.assign(new Error("Video fayl formati yaroqsiz (faqat MP4 yoki WebM qabul qilinadi)"), { status: 400 });
  }
  // F-05: saqlashdan OLDIN bounded container parse — brand/kodex/davomiylik/
  // o'lcham policy'dan o'tmagan fayl HECH QAYERGA yozilmaydi va unga havola
  // berilmaydi (soxta imzoli random body'lar shu yerda 400 bo'ladi).
  parseVideoSafe(inputBuffer);
  const ext = sniffed.ext;
  const contentType = sniffed.contentType;
  const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const filename = `${uniqueId}.${ext}`;
  const storageKey = `${folder}/${filename}`;

  if (r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: inputBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${storageKey}`
      : `/api/storage/${storageKey}`;
    return { url: publicUrl, key: storageKey, size: inputBuffer.length, mimetype: contentType, storage: 'r2' };
  }

  const targetDir = resolveUploadDir(folder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const localFilePath = path.join(targetDir, filename);
  await fs.promises.writeFile(localFilePath, inputBuffer);
  return {
    url: `/uploads/${folder}/${filename}`,
    key: storageKey,
    size: inputBuffer.length,
    mimetype: contentType,
    storage: 'local',
  };
}

/**
 * Streams an object directly from Cloudflare R2 if requested via /api/storage/:key
 */
export async function getR2ObjectStream(key: string) {
  if (!r2Client) {
    throw new Error('R2 is not configured');
  }

  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );

  return response;
}

export interface VerificationUploadResult {
  filename: string;   // basename, e.g. `1700000000-ab12cd34.webp`
  objectKey: string;  // `verifications/<filename>`
  size: number;
  width?: number;
  height?: number;
  storage: 'r2' | 'local';
}

/**
 * SECURITY (P1-1 / P1-2): private verification image store — SEPARATE from the
 * public `processAndStoreImage` path. Re-encodes to WebP (drops EXIF/metadata),
 * writes to the private bucket/prefix, NEVER returns a public URL, and uses
 * private/no-store cache directives. Returns only the object key so the caller
 * can bind it to an owner row server-side (see verification_uploads table).
 */
export async function processAndStoreVerificationImage(
  inputBuffer: Buffer
): Promise<VerificationUploadResult> {
  // F-07 fail-closed: R2 yoqilgan bo'lsa, yopiq bucket SHART — oddiy/public
  // bucket'ga hech qachon yozilmaydi (startup guard'dan o'tib ketgan holatlar
  // uchun qo'shimcha qulf).
  if (r2Client && !PRIVATE_BUCKET_NAME) {
    throw Object.assign(new Error("R2_PRIVATE_BUCKET_NAME sozlanmagan — tasdiq hujjatlarini saqlash o'chiq"), { status: 503 });
  }
  // P2-3: enforce real raster signature before decode (same as listing images).
  assertSafeImageMagic(inputBuffer);
  const processedBuffer = await withImageSlot(async () => {
    const metadata = await sharp(inputBuffer, SHARP_INPUT_OPTS).rotate().metadata();
    assertSafeDimensions(metadata);
    return sharp(inputBuffer, SHARP_INPUT_OPTS)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  }, { ms: DECODE_TIMEOUT_MS, label: 'Verification rasm ishlov' });

  const processedMeta = await sharp(processedBuffer).metadata();
  const uniqueId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const filename = `${uniqueId}.webp`;
  const objectKey = `${VERIFICATION_FOLDER}/${filename}`;

  if (r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: PRIVATE_BUCKET_NAME,
        Key: objectKey,
        Body: processedBuffer,
        ContentType: 'image/webp',
        // Private, never cached — the object must not be public or CDN-storable.
        CacheControl: 'private, no-store, max-age=0',
      })
    );
    return {
      filename,
      objectKey,
      size: processedBuffer.length,
      width: processedMeta.width,
      height: processedMeta.height,
      storage: 'r2',
    };
  }

  // Local fallback: under uploads/verifications (blocked from public static).
  const targetDir = resolveUploadDir(VERIFICATION_FOLDER);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  await fs.promises.writeFile(path.join(targetDir, filename), processedBuffer);
  return {
    filename,
    objectKey,
    size: processedBuffer.length,
    width: processedMeta.width,
    height: processedMeta.height,
    storage: 'local',
  };
}

/**
 * Reads a private verification object (for the signed proxy only). Never exposed
 * as a public URL; the caller must have validated ownership + signature.
 */
export async function getVerificationObjectStream(filename: string) {
  if (!r2Client) throw new Error('R2 is not configured');
  return r2Client.send(
    new GetObjectCommand({
      Bucket: PRIVATE_BUCKET_NAME,
      Key: `${VERIFICATION_FOLDER}/${filename}`,
    })
  );
}

// ─── Media cleanup (F: replaced / decided files must not pile up) ──────────
// R2_PUBLIC_URL'dan olingan base — saqlangan URL'larni qayta taniysh uchun.
const R2_PUBLIC_URL_BASE = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

interface MediaRefTarget {
  key: string;              // `${folder}/${file}`
  folder: string;           // first path segment
  source: 'local' | 'r2path' | 'bare';
}

// Saqlangan manbani (URL yoki bare object_key) rejalashtirilgan O'CHIRISH
// obyektiga ajratadi. BIZNING saqlagichimizga tegishli BO'LMAGAN narsalar
// (tashqi http(s) URL, `public/` ichidagi bundle assetlar `/TOPHAND.uz (1).png`,
// `/favicon-light.png` va h.k.) → null qaytadi va HECH QACHON o'chirilmaydi.
function resolveMediaRef(ref: string): MediaRefTarget | null {
  const trimmed = String(ref || '').trim();
  if (!trimmed) return null;
  const strip = (s: string) => s.split('?')[0].split('#')[0];
  if (trimmed.startsWith('/uploads/')) {
    const key = strip(trimmed.slice('/uploads/'.length));
    return { key, folder: key.split('/')[0] || '', source: 'local' };
  }
  if (trimmed.startsWith('/api/storage/')) {
    const key = strip(trimmed.slice('/api/storage/'.length));
    return { key, folder: key.split('/')[0] || '', source: 'r2path' };
  }
  if (R2_PUBLIC_URL_BASE && trimmed.startsWith(R2_PUBLIC_URL_BASE + '/')) {
    const key = strip(trimmed.slice((R2_PUBLIC_URL_BASE + '/').length));
    return { key, folder: key.split('/')[0] || '', source: 'r2path' };
  }
  // bare object_key (faqat verification_photo_url: `verifications/<file>`) —
  // nuqtasiz/ichki slashsiz, odday `folder/file` ko'rinishida.
  if (/^[a-z0-9][a-z0-9_-]{0,31}\/[a-z0-9][a-z0-9_.-]{0,120}$/i.test(trimmed)) {
    return { key: trimmed, folder: trimmed.split('/')[0], source: 'bare' };
  }
  return null;
}

/**
 * Core single delete attempt. Returns a RESULT (never throws) so callers can
 * decide whether to retry. `skipped` = ref is not ours (external/bundled) or a
 * fail-safe condition; `error` = a GENUINE delete failure worth retrying.
 * Xavfsizlik: faqat BIZNING saqlagich shakllari (`/uploads/`, `/api/storage/`,
 * R2_PUBLIC_URL, yoki bare `verifications/...`) o'chiriladi; tashqi URL'lar
 * tashlanadi; `folder` SAFE_FOLDER_REga mos, key'da `..` yo'q; lokal o'chirish
 * UPLOAD_DIR ichida ekanini tasdiqlaydi.
 */
export async function attemptDeleteStoredMedia(
  ref: string | null | undefined
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  if (!ref) return { ok: false, skipped: true };
  try {
    const target = resolveMediaRef(String(ref));
    if (!target) return { ok: false, skipped: true }; // not ours → skip
    if (!SAFE_FOLDER_RE.test(target.folder)) return { ok: false, skipped: true };
    // traversal / unusual path guard
    if (/(^|\/|\\)\.\.(\/|\\|$)/.test(target.key) || target.key.includes('\\')) return { ok: false, skipped: true };
    const isPrivate = target.folder === VERIFICATION_FOLDER;

    // Qayerda yashaganini URL SHAPE'sidan aniqlaymiz (r2Client hozirgi holatiga
    // emas): R2 yoqilgandan OLDIN yozilgan eski `/uploads/...` havolalarni ham
    // tozalashimiz kerak.
    const onLocal = target.source === 'local' || (target.source === 'bare' && !r2Client);
    if (onLocal) {
      const abs = path.resolve(UPLOAD_DIR, target.key);
      const withSep = UPLOAD_DIR.endsWith(path.sep) ? UPLOAD_DIR : UPLOAD_DIR + path.sep;
      if (abs !== UPLOAD_DIR && !abs.startsWith(withSep)) return { ok: false, skipped: true }; // containment
      await fs.promises.rm(abs, { force: true });
      return { ok: true, skipped: false };
    }

    // R2 obyekti
    if (!r2Client) return { ok: false, skipped: true };
    const bucket = isPrivate ? PRIVATE_BUCKET_NAME : BUCKET_NAME;
    if (!bucket) return { ok: false, skipped: true }; // private bucket sozlanmagan → fail-safe
    await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: target.key }));
    return { ok: true, skipped: false };
  } catch (err: any) {
    const message = err?.message || String(err);
    console.warn('attemptDeleteStoredMedia xato:', message);
    return { ok: false, skipped: false, error: message };
  }
}

/**
 * BEST-EFFORT media o'chirish. Almashinuv (profil/logo/favicon/org/listing) va
 * tasdiq qaroridan (approve/reject) keyin eski fayllar saqlagichda to'planib
 * qolmasligi uchun chaqiriladi. HECH QACHON throw qilmaydi. HAQIQIY o'chirish
 * xatolik bo'lsa (tashqi/review emas) → durable retry queue'ga yoziladi (#10).
 */
export async function deleteStoredMedia(ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  const res = await attemptDeleteStoredMedia(ref);
  if (res.error) await enqueueDeletion(String(ref), res.error);
}
