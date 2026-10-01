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

  // 1. Optimize image using Sharp: convert to WebP, resize if large, keep aspect ratio
  const sharpInstance = sharp(inputBuffer).rotate(); // auto-rotates based on EXIF
  const metadata = await sharpInstance.metadata();

  const processedBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

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
  const targetDir = path.join(UPLOAD_DIR, folder);
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
  const sharpInstance = sharp(inputBuffer).rotate();
  const metadata = await sharpInstance.metadata();

  // Resize logo if overly huge (e.g. > 1024px) but preserve transparency
  const processedBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ quality: 90, compressionLevel: 8 })
    .toBuffer();

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
 * Stores a raw video file (mp4/webm) in Cloudflare R2 or local disk.
 * Faza 13 — video media for listings.
 */
export async function storeVideo(
  inputBuffer: Buffer,
  mimetype: string,
  folder: string = 'videos'
): Promise<UploadResult> {
  const ext = mimetype.includes('webm') ? 'webm' : 'mp4';
  const contentType = mimetype.includes('webm') ? 'video/webm' : 'video/mp4';
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

  const targetDir = path.join(UPLOAD_DIR, folder);
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
