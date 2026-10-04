import { queryAll, runQuery } from '../db/database.ts';

export type MonetizationMode = 'FREE_TEST' | 'PAID';
export type CatalogId = 'services' | 'jobs';

export interface MonetizationConfig {
  monetization_mode: MonetizationMode;
  free_test_end_date: string;
  listing_active_days_free: number;
  listing_active_days_paid: number;
  expiry_warning_days: number;
  listing_price_services: number;
  listing_price_jobs: number;
  renew_enabled_paid: boolean;
  renew_price_services: number;
  renew_price_jobs: number;
  promo_price_services: number;
  promo_price_jobs: number;
  promo_duration_hours: number;
  auto_approve_enabled: boolean;
  // Reklama slotlarini boshqarish (admin monetizatsiya panelidan).
  ads_enabled: boolean;
  ads_top_enabled: boolean;
  ads_popular_enabled: boolean;
  ads_inline_enabled: boolean;
  ads_sidebar_enabled: boolean;
  ads_inline_every: number;
}

const DEFAULTS: MonetizationConfig = {
  monetization_mode: 'FREE_TEST',
  free_test_end_date: new Date(Date.now() + 210 * 24 * 60 * 60 * 1000).toISOString(),
  listing_active_days_free: 7,
  listing_active_days_paid: 30,
  expiry_warning_days: 2,
  listing_price_services: 0,
  listing_price_jobs: 0,
  renew_enabled_paid: false,
  renew_price_services: 0,
  renew_price_jobs: 0,
  promo_price_services: 0,
  promo_price_jobs: 0,
  promo_duration_hours: 24,
  auto_approve_enabled: false,
  ads_enabled: false,
  ads_top_enabled: false,
  ads_popular_enabled: false,
  ads_inline_enabled: false,
  ads_sidebar_enabled: false,
  ads_inline_every: 7,
};

function num(v: string | undefined, fallback: number): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === '1' || v === 'true';
}

/** Read all monetization settings from system_settings into a typed object. */
export async function getMonetizationConfig(): Promise<MonetizationConfig> {
  const rows = await queryAll<{ key: string; value: string }>(
    `SELECT key, value FROM system_settings WHERE key IN (
      'monetization_mode','free_test_end_date','listing_active_days_free','listing_active_days_paid',
      'expiry_warning_days','listing_price_services','listing_price_jobs','renew_enabled_paid',
      'renew_price_services','renew_price_jobs','promo_price_services','promo_price_jobs',
      'promo_duration_hours','auto_approve_enabled',
      'ads_enabled','ads_top_enabled','ads_popular_enabled','ads_inline_enabled','ads_sidebar_enabled','ads_inline_every'
    )`
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    monetization_mode: map.monetization_mode === 'PAID' ? 'PAID' : 'FREE_TEST',
    free_test_end_date: map.free_test_end_date || DEFAULTS.free_test_end_date,
    listing_active_days_free: num(map.listing_active_days_free, DEFAULTS.listing_active_days_free),
    listing_active_days_paid: num(map.listing_active_days_paid, DEFAULTS.listing_active_days_paid),
    expiry_warning_days: num(map.expiry_warning_days, DEFAULTS.expiry_warning_days),
    listing_price_services: num(map.listing_price_services, DEFAULTS.listing_price_services),
    listing_price_jobs: num(map.listing_price_jobs, DEFAULTS.listing_price_jobs),
    renew_enabled_paid: bool(map.renew_enabled_paid, DEFAULTS.renew_enabled_paid),
    renew_price_services: num(map.renew_price_services, DEFAULTS.renew_price_services),
    renew_price_jobs: num(map.renew_price_jobs, DEFAULTS.renew_price_jobs),
    promo_price_services: num(map.promo_price_services, DEFAULTS.promo_price_services),
    promo_price_jobs: num(map.promo_price_jobs, DEFAULTS.promo_price_jobs),
    promo_duration_hours: num(map.promo_duration_hours, DEFAULTS.promo_duration_hours),
    auto_approve_enabled: bool(map.auto_approve_enabled, DEFAULTS.auto_approve_enabled),
    ads_enabled: bool(map.ads_enabled, DEFAULTS.ads_enabled),
    ads_top_enabled: bool(map.ads_top_enabled, DEFAULTS.ads_top_enabled),
    ads_popular_enabled: bool(map.ads_popular_enabled, DEFAULTS.ads_popular_enabled),
    ads_inline_enabled: bool(map.ads_inline_enabled, DEFAULTS.ads_inline_enabled),
    ads_sidebar_enabled: bool(map.ads_sidebar_enabled, DEFAULTS.ads_sidebar_enabled),
    ads_inline_every: num(map.ads_inline_every, DEFAULTS.ads_inline_every),
  };
}

/**
 * Faza 6 — auto transition: paid if mode is PAID OR the free test end date has passed.
 */
export function isPaidNow(cfg: MonetizationConfig, at: Date = new Date()): boolean {
  if (cfg.monetization_mode === 'PAID') return true;
  const endDate = new Date(cfg.free_test_end_date);
  return !isNaN(endDate.getTime()) && at.getTime() >= endDate.getTime();
}

/** Effective active-days for a new listing / renewal, based on current mode. */
export function resolveActiveDays(cfg: MonetizationConfig, at?: Date): number {
  return isPaidNow(cfg, at) ? cfg.listing_active_days_paid : cfg.listing_active_days_free;
}

/** Expiry-warning window in days. */
export function resolveWarningDays(cfg: MonetizationConfig): number {
  return cfg.expiry_warning_days;
}

function normalizeCatalog(catalogId?: string | null): CatalogId {
  return catalogId === 'jobs' ? 'jobs' : 'services';
}

/** Price to publish a listing (0 during FREE_TEST). */
export function getListingPrice(cfg: MonetizationConfig, catalogId?: string | null, at?: Date): number {
  if (!isPaidNow(cfg, at)) return 0;
  return normalizeCatalog(catalogId) === 'jobs' ? cfg.listing_price_jobs : cfg.listing_price_services;
}

/** Price to renew/restore a listing (0 during FREE_TEST or when renew disabled). */
export function getRenewPrice(cfg: MonetizationConfig, catalogId?: string | null, at?: Date): number {
  if (!isPaidNow(cfg, at)) return 0;
  if (!cfg.renew_enabled_paid) return 0;
  return normalizeCatalog(catalogId) === 'jobs' ? cfg.renew_price_jobs : cfg.renew_price_services;
}

/** Price to promote a listing to the top (0 during FREE_TEST). */
export function getPromoPrice(cfg: MonetizationConfig, catalogId?: string | null, at?: Date): number {
  if (!isPaidNow(cfg, at)) return 0;
  return normalizeCatalog(catalogId) === 'jobs' ? cfg.promo_price_jobs : cfg.promo_price_services;
}

/** Public view of monetization for the frontend (single source of truth). */
export async function getPublicMonetization() {
  const cfg = await getMonetizationConfig();
  const paid = isPaidNow(cfg);
  return {
    mode: paid ? 'PAID' : ('FREE_TEST' as MonetizationMode),
    free_test_end_date: cfg.free_test_end_date,
    active_days: resolveActiveDays(cfg),
    warning_days: resolveWarningDays(cfg),
    prices: {
      listing: { services: getListingPrice(cfg, 'services'), jobs: getListingPrice(cfg, 'jobs') },
      renew: { services: getRenewPrice(cfg, 'services'), jobs: getRenewPrice(cfg, 'jobs') },
      promo: { services: getPromoPrice(cfg, 'services'), jobs: getPromoPrice(cfg, 'jobs') },
    },
    renew_enabled_paid: cfg.renew_enabled_paid,
    promo_duration_hours: cfg.promo_duration_hours,
    ads: {
      enabled: cfg.ads_enabled,
      top: cfg.ads_top_enabled,
      popular: cfg.ads_popular_enabled,
      inline: cfg.ads_inline_enabled,
      sidebar: cfg.ads_sidebar_enabled,
      inline_every: cfg.ads_inline_every,
    },
  };
}

/** Set a single monetization setting (upsert). Used by admin (Faza 3). */
export async function setSetting(key: string, value: string, updatedBy?: string | null) {
  const now = new Date().toISOString();
  await runQuery(
    `INSERT INTO system_settings (key, value, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
    [key, value, now, updatedBy || null]
  );
}
