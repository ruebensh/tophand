import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.ts';

// ─── Google Search Console analitika servisi ─────────────────────────────
// Brauzerda (Google'da) "tophand"ni qidirganlar (impressions) va natijadan
// saytga bosganlar (clicks) — bu ma'lumot sayt loglarida YO'Q, faqat GSC'da.
// Konfiguratsiyasi: env (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL)
// yoki admin Sozlamalar orqali system_settings'da saqlanadi (env ustun).
// Service account GSC resursida "User" huquqi bilan qo'shilgan bo'lishi kerak.

const GSCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Legacy (endpoints) API — siteUrl resource uchun keng qo'llaniladi:
const GSC_QUERY_URL = (siteUrl: string) =>
  `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

// 12 soatlik kesh — GSC ma'lumoti kechikib yangilanadi, har safar so'rov qilish
// shart emas. Kalit: `${siteUrl}|${days}`.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: GscAnalytics | GscMonthlyAnalytics }>();

/** Konfiguratsiya o'zgarganda keshni tozalash (admin PUT /gsc/config). */
export function clearGscCache() {
  cache.clear();
}

export interface GscDayRow {
  date: string;        // YYYY-MM-DD
  impressions: number;
  clicks: number;
}

export interface GscQueryRow {
  query: string;
  impressions: number;
  clicks: number;
}

export interface GscAnalytics {
  status: 'OK' | 'NOT_CONFIGURED' | 'ERROR';
  days: GscDayRow[];
  top_queries: GscQueryRow[];
  totals: { impressions: number; clicks: number };
  fetched_at: string | null;
  error?: string;
}

interface GscConfig {
  clientEmail: string;
  privateKey: string;
  siteUrl: string;
}

/** Env -> system_settings tartibida konfiguratsiyani yig'adi. */
async function resolveGscConfig(): Promise<GscConfig | null> {
  const readSetting = async (key: string): Promise<string> => {
    const row = await queryOne<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
    return (row?.value || '').trim();
  };

  const clientEmail = (process.env.GSC_CLIENT_EMAIL || '').trim() || (await readSetting('gsc_client_email'));
  // Admin panelga kiritilgan kalitda yangi qatorlar \n literal bo'lib qolishi mumkin.
  const rawKey = (process.env.GSC_PRIVATE_KEY || '').trim() || (await readSetting('gsc_private_key'));
  const siteUrl = (process.env.GSC_SITE_URL || '').trim() || (await readSetting('gsc_site_url'));

  if (!clientEmail || !rawKey || !siteUrl) return null;
  const privateKey = rawKey.replace(/\\n/g, '\n');
  return { clientEmail, privateKey, siteUrl };
}

/** OAuth2 service-account token (RS256 JWT assertion -> Google token endpoint). */
async function getAccessToken(cfg: GscConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { scope: GSCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now, iss: cfg.clientEmail, sub: cfg.clientEmail },
    cfg.privateKey,
    { algorithm: 'RS256' }
  );
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token so'rovi rad etildi (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json() as { access_token?: string };
  if (!json.access_token) throw new Error('Google token javobida access_token yo\'q');
  return json.access_token;
}

/** GSC searchanalytics:query — aniq sana oralig'ida bir o'lcham bo'yicha rows. */
async function queryGscRange(
  cfg: GscConfig, token: string, startDate: string, endDate: string,
  dim: 'date' | 'query', rowLimit: number
) {
  const body = { startDate, endDate, dimensions: [dim], rowLimit };
  const res = await fetch(GSC_QUERY_URL(cfg.siteUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GSC so'rovi rad etildi (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json() as { rows?: { keys: string[]; impressions: number; clicks: number }[] };
  return json.rows || [];
}

/** So'nggi `days` kunlik rows + qidiruv so'zi rows (eski kunlik endpoint). */
async function queryGsc(cfg: GscConfig, token: string, days: number, dim: 'date' | 'query') {
  const today = new Date();
  const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return queryGscRange(cfg, token, fmt(start), fmt(today), dim, dim === 'date' ? days + 1 : 25);
}

/**
 * Asosiy kirish nuqtasi: so'nggi `days` kunlik impressions/clicks + top
 * qidiruvlar. Keshlangan bo'lsa darhol qaytadi; konfiguratsiya bo'lmasa
 * NOT_CONFIGURED (modal tushunarli bo'sh holat ko'rsatadi).
 */
export async function getGscAnalytics(days = 28): Promise<GscAnalytics> {
  const cacheKey = `gsc|${days}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as GscAnalytics;

  const cfg = await resolveGscConfig();
  if (!cfg) {
    return { status: 'NOT_CONFIGURED', days: [], top_queries: [], totals: { impressions: 0, clicks: 0 }, fetched_at: null };
  }

  try {
    const token = await getAccessToken(cfg);
    const [dateRows, queryRows] = await Promise.all([
      queryGsc(cfg, token, days, 'date'),
      queryGsc(cfg, token, days, 'query'),
    ]);
    const data: GscAnalytics = {
      status: 'OK',
      days: dateRows.map((r) => ({
        date: r.keys[0],
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
      })),
      top_queries: queryRows.map((r) => ({
        query: r.keys[0],
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
      })),
      totals: {
        impressions: dateRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0),
        clicks: dateRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0),
      },
      fetched_at: new Date().toISOString(),
    };
    cache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch (err) {
    // Tashqi xatoni modalsiz qoldirmaymiz: ERROR holati + sabab matni.
    return {
      status: 'ERROR',
      error: (err as Error)?.message?.slice(0, 300) || 'GSC xatosi',
      days: [],
      top_queries: [],
      totals: { impressions: 0, clicks: 0 },
      fetched_at: null,
    };
  }
}

export interface GscMonthRow {
  month: string;       // YYYY-MM
  impressions: number;
  clicks: number;
}

export interface GscMonthlyAnalytics {
  status: 'OK' | 'NOT_CONFIGURED' | 'ERROR';
  months: GscMonthRow[];
  top_queries: GscQueryRow[];
  totals: { impressions: number; clicks: number };
  fetched_at: string | null;
  error?: string;
}

/**
 * Oylik analitika: so'nggi `months` (1..16) oy uchun impressions/clicks.
 * GSC kunlik rows qaytaradi -> oy (YYYY-MM) bo'yicha jamlanadi va bo'sh
 * oylar 0 bilan to'ldiriladi (chiziqli grafik uzluksiz bo'lishi uchun).
 */
export async function getGscMonthly(months = 12): Promise<GscMonthlyAnalytics> {
  const span = Math.min(16, Math.max(1, months));
  const cacheKey = `gscM|${span}`;
  const hit = cache.get(cacheKey) as { at: number; data: GscMonthlyAnalytics } | undefined;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const cfg = await resolveGscConfig();
  if (!cfg) {
    return { status: 'NOT_CONFIGURED', months: [], top_queries: [], totals: { impressions: 0, clicks: 0 }, fetched_at: null };
  }

  try {
    const token = await getAccessToken(cfg);
    const now = new Date();
    const startD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (span - 1), 1));
    const start = startD.toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    const spanDays = Math.round((now.getTime() - startD.getTime()) / 86400000) + 2;
    const [dateRows, queryRows] = await Promise.all([
      queryGscRange(cfg, token, start, end, 'date', spanDays),
      queryGscRange(cfg, token, start, end, 'query', 25),
    ]);

    // Kunlik rows -> oy (YYYY-MM) bo'yicha jamlash.
    const byMonth = new Map<string, { i: number; c: number }>();
    for (const r of dateRows) {
      const key = String(r.keys[0]).slice(0, 7);
      const cur = byMonth.get(key) || { i: 0, c: 0 };
      cur.i += Number(r.impressions) || 0;
      cur.c += Number(r.clicks) || 0;
      byMonth.set(key, cur);
    }
    // So'nggi `span` oy ro'yxati (eski -> yangi), bo'sh oylar 0.
    const monthsArr: GscMonthRow[] = [];
    for (let k = 0; k < span; k++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (span - 1) + k, 1));
      const key = d.toISOString().slice(0, 7);
      const v = byMonth.get(key) || { i: 0, c: 0 };
      monthsArr.push({ month: key, impressions: v.i, clicks: v.c });
    }

    const data: GscMonthlyAnalytics = {
      status: 'OK',
      months: monthsArr,
      top_queries: queryRows.map((r) => ({
        query: r.keys[0],
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
      })),
      totals: monthsArr.reduce(
        (s, m) => ({ impressions: s.impressions + m.impressions, clicks: s.clicks + m.clicks }),
        { impressions: 0, clicks: 0 }
      ),
      fetched_at: new Date().toISOString(),
    };
    cache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch (err) {
    return {
      status: 'ERROR',
      error: (err as Error)?.message?.slice(0, 300) || 'GSC xatosi',
      months: [],
      top_queries: [],
      totals: { impressions: 0, clicks: 0 },
      fetched_at: null,
    };
  }
}

/** GSC konfiguratsiyasi holati (secret qiymatlar qaytarilmaydi — faqat belgilar). */
export async function getGscConfigStatus(): Promise<{
  configured: boolean;
  client_email: string;
  site_url: string;
  has_private_key: boolean;
  source: 'env' | 'db' | 'none';
}> {
  const envSet = Boolean(
    (process.env.GSC_CLIENT_EMAIL || '').trim() &&
    (process.env.GSC_PRIVATE_KEY || '').trim() &&
    (process.env.GSC_SITE_URL || '').trim()
  );
  const read = async (key: string) =>
    ((await queryOne<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]))?.value || '').trim();
  const clientEmail = (process.env.GSC_CLIENT_EMAIL || '').trim() || (await read('gsc_client_email'));
  const privateKey = (process.env.GSC_PRIVATE_KEY || '').trim() || (await read('gsc_private_key'));
  const siteUrl = (process.env.GSC_SITE_URL || '').trim() || (await read('gsc_site_url'));
  return {
    configured: Boolean(clientEmail && privateKey && siteUrl),
    client_email: clientEmail,
    site_url: siteUrl,
    has_private_key: Boolean(privateKey),
    source: envSet ? 'env' : clientEmail ? 'db' : 'none',
  };
}
