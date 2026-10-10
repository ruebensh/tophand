import crypto from 'crypto';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import { sanitizeUserUrl, sanitizeUserUrlLoose } from '../lib/urlSecurity.ts';
import { deleteStoredMediaIfUnreferenced } from './mediaCleanupService.ts';

// ============================================================================
//  adService — ichki Reklama menejeri uchun yagona ma'lumot qatlami.
// ----------------------------------------------------------------------------
//  Kampaniyalar `ads` jadvalida saqlanadi (type: image|text|video). Admin CRUD
//  + frontend uchun faqat "aktiv" (yoqilgan va sana oynasi ichidagi) kampaniyalar
//  qaytariladi. Sana filtri JS tomonida — starts_at/ends_at TEXT (ISO) saqlanadi.
// ============================================================================

export type AdType = 'image' | 'text' | 'video';
export type AdPlacement = 'top' | 'popular' | 'inline' | 'sidebar' | 'all';

export interface Ad {
  id: string;
  type: AdType;
  title: string;
  body: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string;
  cta_label: string;
  placement: AdPlacement;
  active: number;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

export interface AdInput {
  type: AdType;
  title: string;
  body?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  link_url: string;
  cta_label?: string;
  placement: AdPlacement;
  active?: boolean | number;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
}

const AD_TYPES: AdType[] = ['image', 'text', 'video'];
const AD_PLACEMENTS: AdPlacement[] = ['top', 'popular', 'inline', 'sidebar', 'all'];

/** Maydonlarni tozalab, xato haqida qisqa sabab qaytaradi (null = ok). */
export function validateAd(input: Partial<AdInput>): string | null {
  if (!input.type || !AD_TYPES.includes(input.type)) return "Noto'g'ri reklama turi";
  if (!input.placement || !AD_PLACEMENTS.includes(input.placement)) return "Noto'g'ri joylashuv";
  if (!input.title || !input.title.trim()) return 'Sarlavha kerak';
  if (!input.link_url || !input.link_url.trim()) return "Havola (link) kerak";
  if (input.type === 'image' && !input.image_url) return "Rasmli reklama uchun rasm yuklang";
  if (input.type === 'video' && !input.video_url) return "Video reklama uchun video yoki URL kerak";
  return null;
}

function toIsoOrNull(v?: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeActive(v: boolean | number | undefined): number {
  if (v === undefined) return 1;
  return v === true || v === 1 || (v as any) === '1' ? 1 : 0;
}

/** Admin: barcha kampaniyalar (priority va yaratilgan sana bo'yicha). */
export async function listAllAds(): Promise<Ad[]> {
  return queryAll<Ad>(
    `SELECT * FROM ads ORDER BY priority DESC, created_at DESC`
  );
}

/** Frontend: faqat aktiv + sana oynasi ichidagi kampaniyalar. */
export async function getActiveAds(): Promise<Ad[]> {
  const rows = await queryAll<Ad>(
    `SELECT * FROM ads WHERE active = 1 ORDER BY priority DESC, created_at DESC`
  );
  const now = Date.now();
  return rows.filter((r) => {
    if (r.starts_at) {
      const s = new Date(r.starts_at).getTime();
      if (!isNaN(s) && now < s) return false;
    }
    if (r.ends_at) {
      const e = new Date(r.ends_at).getTime();
      if (!isNaN(e) && now > e) return false;
    }
    return true;
  });
}

export async function getAdById(id: string): Promise<Ad | null> {
  return queryOne<Ad>(`SELECT * FROM ads WHERE id = ?`, [id]);
}

export async function createAd(input: AdInput): Promise<Ad | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO ads
      (id, type, title, body, image_url, video_url, link_url, cta_label, placement,
       active, priority, starts_at, ends_at, impressions, clicks, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [
      id,
      input.type,
      input.title.trim(),
      input.body?.trim() || null,
      sanitizeUserUrl(input.image_url) || null,
      sanitizeUserUrl(input.video_url) || null,
      sanitizeUserUrlLoose(input.link_url) || '#',
      input.cta_label?.trim() || 'Batafsil',
      input.placement,
      normalizeActive(input.active),
      Number.isFinite(Number(input.priority)) ? Math.round(Number(input.priority)) : 0,
      toIsoOrNull(input.starts_at),
      toIsoOrNull(input.ends_at),
      now,
      now,
    ]
  );
  return getAdById(id);
}

/** Qisman yangilash — faqat kelgan maydonlar o'zgaradi. */
export async function updateAd(id: string, input: Partial<AdInput>): Promise<Ad | null> {
  const existing = await getAdById(id);
  if (!existing) return null;

  const merged: AdInput = {
    type: (input.type ?? existing.type) as AdType,
    placement: (input.placement ?? existing.placement) as AdPlacement,
    title: input.title !== undefined ? input.title : existing.title,
    link_url: input.link_url !== undefined ? input.link_url : existing.link_url,
    body: input.body !== undefined ? input.body : existing.body,
    image_url: input.image_url !== undefined ? input.image_url : existing.image_url,
    video_url: input.video_url !== undefined ? input.video_url : existing.video_url,
    cta_label: input.cta_label !== undefined ? input.cta_label : existing.cta_label,
    active: input.active !== undefined ? input.active : Boolean(existing.active),
    priority: input.priority !== undefined ? input.priority : existing.priority,
    starts_at:
      input.starts_at !== undefined ? input.starts_at : existing.starts_at,
    ends_at: input.ends_at !== undefined ? input.ends_at : existing.ends_at,
  };

  await runQuery(
    `UPDATE ads SET
      type = ?, title = ?, body = ?, image_url = ?, video_url = ?, link_url = ?,
      cta_label = ?, placement = ?, active = ?, priority = ?, starts_at = ?, ends_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      merged.type,
      merged.title.trim(),
      merged.body?.trim() || null,
      sanitizeUserUrl(merged.image_url) || null,
      sanitizeUserUrl(merged.video_url) || null,
      sanitizeUserUrlLoose(merged.link_url) || '#',
      merged.cta_label?.trim() || 'Batafsil',
      merged.placement,
      normalizeActive(merged.active),
      Number.isFinite(Number(merged.priority)) ? Math.round(Number(merged.priority)) : 0,
      toIsoOrNull(merged.starts_at),
      toIsoOrNull(merged.ends_at),
      new Date().toISOString(),
      id,
    ]
  );
  // Report #6: media almashtirilsa, eski faylni o'chiramiz (faqat bizniki;
  // tashqi URL'lar deleteStoredMedia'da tashlanadi). Yangi manzil DB'ga
  // saqlangandan KEYIN o'chiramiz — shunda update muvaffaqiyatsiz bo'lsa fayl qoladi.
  // Report #3: almashtirishda eski faylni FAQAT boshqa yashovchi qatorlar ham
  // unga bog'lanmagan bo'lsa o'chiramiz (break-image oldini olish).
  const newImage = sanitizeUserUrl(merged.image_url) || null;
  const newVideo = sanitizeUserUrl(merged.video_url) || null;
  if (existing.image_url && existing.image_url !== newImage) await deleteStoredMediaIfUnreferenced(existing.image_url);
  if (existing.video_url && existing.video_url !== newVideo) await deleteStoredMediaIfUnreferenced(existing.video_url);
  return getAdById(id);
}

export async function deleteAd(id: string): Promise<boolean> {
  const existing = await getAdById(id);
  const res = await runQuery(`DELETE FROM ads WHERE id = ?`, [id]);
  if (res.changes > 0 && existing) {
    // Report #6/#3: reklama o'chirilganda media fayli ham ketadi (faqat bizniki,
    // agar boshqa qator hali unga bog'liq bo'lmasa).
    if (existing.image_url) await deleteStoredMediaIfUnreferenced(existing.image_url);
    if (existing.video_url) await deleteStoredMediaIfUnreferenced(existing.video_url);
  }
  return res.changes > 0;
}

export async function incrementImpression(id: string): Promise<void> {
  await runQuery(`UPDATE ads SET impressions = impressions + 1 WHERE id = ?`, [id]);
}

export async function incrementClick(id: string): Promise<void> {
  await runQuery(`UPDATE ads SET clicks = clicks + 1 WHERE id = ?`, [id]);
}
