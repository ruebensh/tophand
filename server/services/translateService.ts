// ============================================================================
//  translateService — Google Cloud Translation (v2 Basic) + translation_cache.
//  Foydalanuvchi kontentini (e'lon sarlavha/matn, izoh, tashkilot tavsifi)
//  ru/en ga avtomatik tarjima qiladi. Har bir tarjima bir marta qilinib
//  translation_cache jadvalida saqlanadi (keyin tekin/tez).
//
//  Env: GOOGLE_TRANSLATE_API_KEY (majburiy) — Google Cloud Console'dan API kaliti
//  (Translation API yoqilgan holda). Kalit bo'lmasa sayt asl tilida ishlayveradi
//  (graceful). 500 000 belgi/oy bepul, keyin ~$20/1M.
// ============================================================================

import crypto from 'crypto';
import { queryAll, runQuery } from '../db/database.ts';

const TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// Google v2 bitta so'rovda tilni aniqlash (auto) — `source` kiritilmaydi.
const MAX_BATCH = 30;        // bir so'rovda maksimal matn soni
const MAX_CHARS_PER_REQ = 5000; // bitta so'rov uchun maksimal belgilar

export function isTranslateConfigured(): boolean {
  return Boolean((process.env.GOOGLE_TRANSLATE_API_KEY || '').trim());
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

interface CacheRow {
  src_hash: string;
  target_lang: string;
  out_text: string;
}

// Berilgan target tilda keshdan topilgan tarjimani qaytaradi (hash → text).
async function lookupCache(texts: string[], target: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (texts.length === 0) return found;
  const hashes = texts.map((t) => sha256(t));
  const placeholders = hashes.map(() => '?').join(',');
  const rows = await queryAll<CacheRow>(
    `SELECT src_hash, target_lang, out_text FROM translation_cache
     WHERE target_lang = ? AND src_hash IN (${placeholders})`,
    [target, ...hashes]
  );
  for (const r of rows) found.set(`${r.target_lang}|${r.src_hash}`, r.out_text);
  return found;
}

async function storeCache(texts: string[], outputs: string[], target: string, sourceLang: string | null): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < texts.length; i++) {
    const src = texts[i];
    const out = outputs[i];
    if (out == null) continue;
    const id = `tr_${crypto.randomUUID()}`;
    await runQuery(
      `INSERT INTO translation_cache (id, src_hash, src_text, source_lang, target_lang, out_text, engine, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'google', ?)
       ON CONFLICT (src_hash, target_lang) DO UPDATE SET out_text = EXCLUDED.out_text`,
      [id, sha256(src), src, sourceLang, target, out, now]
    );
  }
}

async function callGoogle(texts: string[], target: string): Promise<{ translations: string[]; detectedLang: string | null }> {
  const apiKey = (process.env.GOOGLE_TRANSLATE_API_KEY || '').trim();
  if (!apiKey) throw new Error('GOOGLE_TRANSLATE_API_KEY sozlanmagan');

  const url = `${TRANSLATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  // `source` kiritilmaydi → Google tilni avtomatik aniqlaydi.
  const body = { q: texts, target, format: 'text' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Translate ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const list: any[] = data?.data?.translations || [];
    const translations: string[] = list.map((t) => t.translatedText ?? '');
    // Uzunlik mos kelmasa xavfsizlik uchun '' belgilaymiz.
    while (translations.length < texts.length) translations.push('');
    const detectedLang = list[0]?.detectedSourceLanguage ?? null;
    return { translations, detectedLang };
  } finally {
    clearTimeout(timer);
  }
}

// Matnlarni belgar bo'yicha chunk'larga bo'lib, ketma-ket Google'ga yuborish uchun.
// Har bir element o'z original indekshini saqlab qoladi (duplikatlar uchun xavfsiz).
interface NeedItem {
  idx: number;
  text: string;
}
function chunkByLimits(items: NeedItem[]): NeedItem[][] {
  const chunks: NeedItem[][] = [];
  let cur: NeedItem[] = [];
  let curChars = 0;
  for (const it of items) {
    const len = (it.text || '').length;
    if (cur.length >= MAX_BATCH || (curChars + len > MAX_CHARS_PER_REQ && cur.length > 0)) {
      chunks.push(cur);
      cur = [];
      curChars = 0;
    }
    cur.push(it);
    curChars += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export interface TranslateResult {
  translations: string[]; // input tartibi bilan bir xil uzunlikda
  sourceLang: string | null;
  cachedCount: number;
  translatedCount: number;
}

/**
 * `texts` ni `target` tildiga tarjima qiladi (kesh bilan).
 * target ∈ {'ru','en'} — uz/uz-Cyrl bu funksiyaga kelmaydi (translit frontend'da).
 */
export async function translateTexts(texts: string[], target: string): Promise<TranslateResult> {
  const normalized = texts.map((t) => (typeof t === 'string' ? t : ''));
  if (target !== 'ru' && target !== 'en') {
    throw new Error('unsupported target');
  }
  if (!isTranslateConfigured()) {
    throw new Error('not-configured');
  }

  const cache = await lookupCache(normalized, target);
  const out: string[] = new Array(normalized.length);
  const needIdx: number[] = [];
  let cachedCount = 0;

  for (let i = 0; i < normalized.length; i++) {
    const src = normalized[i];
    const hit = cache.get(`${target}|${sha256(src)}`);
    if (hit != null && src.trim() !== '') {
      out[i] = hit;
      cachedCount++;
    } else if (src.trim() === '') {
      out[i] = src; // bo'sh matn — o'zgarishsiz
      cachedCount++;
    } else {
      needIdx.push(i);
    }
  }

  let translatedCount = 0;
  let sourceLang: string | null = null;

  if (needIdx.length > 0) {
    const needItems: NeedItem[] = needIdx.map((i) => ({ idx: i, text: normalized[i] }));
    for (const chunk of chunkByLimits(needItems)) {
      const { translations, detectedLang } = await callGoogle(chunk.map((c) => c.text), target);
      if (detectedLang) sourceLang = detectedLang;
      for (let j = 0; j < chunk.length; j++) {
        const srcText = chunk[j].text;
        const translated = translations[j] ?? '';
        out[chunk[j].idx] = translated || srcText;
        translatedCount++;
        if (translated) {
          await storeCache([srcText], [translated], target, detectedLang);
        }
      }
    }
  }

  return { translations: out, sourceLang, cachedCount, translatedCount };
}
