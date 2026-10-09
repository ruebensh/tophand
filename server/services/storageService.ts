import dotenv from 'dotenv';
dotenv.config();

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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

// SECURITY (M-04): resource-exhaustion / decompression-bomb guards for the image
// decoder. We bound total input pixels, per-side dimensions, disable animated
// multi-frame decoding, fail on any corrupt pixel data, and cap decode/encode
// wall-clock time so a hostile image can't pin the event loop or exhaust RAM.
const MAX_INPUT_PIXELS = 40_000_000; // ~40MP total
const MAX_INPUT_DIM = 10_000;        // max any single side (px)
const DECODE_TIMEOUT_MS = 20_000;    // hard cap for one image pipeline
const SHARP_INPUT_OPTS = {
  limitInputPixels: MAX_INPUT_PIXELS,
  failOn: 'error' as const,
  animated: false,
};

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
    throw Object.assign(new Error("Rasm o'lchami juda katta (ruxsat etilgan maksimum ~40MP)"), { status: 400 });
  }
}
function sanitizeFolder(folder: string | undefined, fallback: string): string {
  const value = (folder || '').trim().toLowerCase();
  if (!value) return fallback;
  if (!SAFE_FOLDER_RE.test(value)) {
    throw Object.assign(new Error('Noto‘g‘ri yuklash katalogi (faqat harf, raqam, _ va - ruxsat)'), { status: 400 });
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

  // 1. Optimize image using Sharp: convert to WebP, resize if large, keep aspect ratio
  const sharpInstance = sharp(inputBuffer, SHARP_INPUT_OPTS).rotate(); // auto-rotates based on EXIF
  const metadata = await sharpInstance.metadata();
  assertSafeDimensions(metadata);

  const processedBuffer = await withTimeout(
    sharp(inputBuffer, SHARP_INPUT_OPTS)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer(),
    DECODE_TIMEOUT_MS,
    'Rasm ishlov'
  );

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
  const sharpInstance = sharp(inputBuffer, SHARP_INPUT_OPTS).rotate();
  const metadata = await sharpInstance.metadata();
  assertSafeDimensions(metadata);

  // Resize logo if overly huge (e.g. > 1024px) but preserve transparency
  const processedBuffer = await withTimeout(
    sharp(inputBuffer, SHARP_INPUT_OPTS)
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ quality: 90, compressionLevel: 8 })
      .toBuffer(),
    DECODE_TIMEOUT_MS,
    'Logo ishlov'
  );

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
  const processedBuffer = await withTimeout(
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
    DECODE_TIMEOUT_MS,
    'Favicon ishlov'
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
