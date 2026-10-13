/**
 * AI keshi (Cloudflare R2 + in-memory L1) — TopHand.
 *
 * Maqsad: bir xil e'lonlar (masalan har kungi "Cobalt") uchun Gemini'ni qayta
 * so'ramaslik — natijani keshdan qaytarish. Bu API limitini/pulini tejaydi va
 * javobni tezlashtiradi.
 *
 * Qayerda saqlanadi:
 *   - L2 (bardoshli): R2 bucket ichida alohida `ai-cache/` prefiksida JSON
 *     obyekt sifatida (media `listings/`/`logo/`dan butunlay ajratilgan). R2
 *     bo'lmasa (lokal dev) → `uploads/ai-cache/<key>.json` diskka yoziladi.
 *   - L1 (tez): jarayon ichidagi `Map` (TTL + sig'im chegarasi). Restart'da
 *     tozalanadi — L2 uni qoplaydi.
 *
 * Xavfsizlik / chidamlilik:
 *   - Kalit serverda hisoblanadigan sha256 hash — foydalanuvchi kiritgan matn
 *     to'g'ridan-to'g'ri obyekt kaliti bo'LMAYDI (traversal/injection yo'q).
 *   - Har qanday saqlash/o'qish xatosi → "miss" deb qaraladi (hech qachon
 *     e'lon yaratishni buzmanadi).
 */
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { r2Client, BUCKET_NAME } from './storageService.ts';

const PREFIX = 'ai-cache';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 soat
const L1_MAX = 800; // xotira chegarasi (LRU-ish: eng eski kiritilgan chiqariladi)

interface CacheEntry {
  createdAt: number;
  data: any;
}

// L1 — jarayon xotirasi. Map kiritish tartibini saqlaydi → FIFO eviksiya.
const l1 = new Map<string, CacheEntry>();

// Sarlavhani normallashtirish: "Cobalt 2020", "  cobalt  2020 " → bitta kalit.
export function normalizeTitle(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim();
}

// Obyekt kaliti — tur (attr|desc) + qism(lar)dan sha256.
export function cacheKey(kind: 'attr' | 'desc', parts: string): string {
  return crypto.createHash('sha256').update(`${kind}:${parts}`).digest('hex');
}

// Kategoriyadagi atribut sxemasining versiyasi (hash). Admin atribut qo'shsa /
// o'chirsa / option o'zgartirsa → versiya o'zgaradi → eski kesh avtomatik bekor.
export function schemaVersionOf(
  rows: Array<{ key: string; options?: any }>
): string {
  const sig = rows
    .map((r) => {
      const opts = Array.isArray(r.options) ? r.options.join('|') : '';
      return `${r.key}=${opts}`;
    })
    .sort()
    .join(';');
  return crypto.createHash('sha1').update(sig).digest('hex').slice(0, 16);
}

function l1Set(key: string, entry: CacheEntry): void {
  if (l1.size >= L1_MAX) {
    const oldest = l1.keys().next().value;
    if (oldest !== undefined) l1.delete(oldest);
  }
  l1.set(key, entry);
}

function localFilePath(key: string): string {
  // Kalit har doim bizning sha256 hex — xavfsi static segment.
  return path.resolve(process.cwd(), 'uploads', PREFIX, `${key}.json`);
}

// ─── L2 (R2 yoki lokal disk) ────────────────────────────────────────────
async function putL2(key: string, entry: CacheEntry): Promise<void> {
  const body = JSON.stringify(entry);
  if (r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${PREFIX}/${key}.json`,
        Body: body,
        ContentType: 'application/json',
        // Kesh — uzoq saqlash mantiqsiz; biz TTL'ni o'zimiz boshqaramiz.
        CacheControl: 'private, no-store, max-age=0',
      })
    );
    return;
  }
  const fp = localFilePath(key);
  await fs.promises.mkdir(path.dirname(fp), { recursive: true });
  await fs.promises.writeFile(fp, body, 'utf-8');
}

async function getL2(key: string): Promise<CacheEntry | null> {
  try {
    if (r2Client) {
      const res = await r2Client.send(
        new GetObjectCommand({ Bucket: BUCKET_NAME, Key: `${PREFIX}/${key}.json` })
      );
      const text = await (res as any).Body.transformToString('utf-8');
      return JSON.parse(text) as CacheEntry;
    }
    const text = await fs.promises.readFile(localFilePath(key), 'utf-8');
    return JSON.parse(text) as CacheEntry;
  } catch {
    // NoSuchKey / o'qish xatosi → miss
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────
export async function cacheGet(key: string): Promise<any | null> {
  const mem = l1.get(key);
  if (mem) {
    if (Date.now() - mem.createdAt <= TTL_MS) return mem.data;
    l1.delete(key); // muddati o'tgan
  }
  const entry = await getL2(key);
  if (entry && typeof entry.createdAt === 'number' && Date.now() - entry.createdAt <= TTL_MS) {
    l1Set(key, entry);
    return entry.data;
  }
  return null;
}

// Bo'sh natijani keshLAYMIZ (kelajakda AI/ heuristic ko'proq to'ldirishi mumkin).
export async function cacheSet(key: string, data: any): Promise<void> {
  const entry: CacheEntry = { createdAt: Date.now(), data };
  l1Set(key, entry);
  try {
    await putL2(key, entry);
  } catch {
    /* L2 yozish xatosi — L1 baribir ishlaydi; e'lon yaratishni buzmaydi */
  }
}

// Maqsudli tozalash (admin atribut o'zgartirganda ixtiyoriy chaqirilishi mumkin).
export function clearInMemoryCache(): void {
  l1.clear();
}
