const TOKEN_KEY = 'tophand_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs, ...init } = options;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Abort client-side so a stalled server never leaves the UI hanging forever.
  let signal: AbortSignal | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0) {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    signal = controller.signal;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, { ...init, headers, signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Server javob bermadi. Ulanish vaqtinchalik uzildi — qaytadan urinib ko‘ring.');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `So‘rov bajarilmadi: status ${response.status}`);
  }

  return data as T;
}

export async function uploadImageFile(file: File, folder?: string): Promise<string> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('image', file);

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = folder ? `/api/upload?folder=${encodeURIComponent(folder)}` : '/api/upload';
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Rasm yuklashda xatolik');
  }
  return data.url as string;
}

// Faza 13 — upload a listing video (mp4/webm), returns its URL.
export async function uploadVideoFile(file: File): Promise<string> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('video', file);

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch('/api/upload/video', {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Video yuklashda xatolik');
  }
  return data.url as string;
}

// ─── Monetization + Wallet helpers (Faza 4-5,10) ──────────────────────
export interface PublicMonetization {
  mode: 'FREE_TEST' | 'PAID';
  free_test_end_date: string;
  active_days: number;
  warning_days: number;
  prices: {
    listing: { services: number; jobs: number };
    renew: { services: number; jobs: number };
    promo: { services: number; jobs: number };
  };
  renew_enabled_paid: boolean;
  promo_duration_hours: number;
  ads: {
    enabled: boolean;
    top: boolean;
    popular: boolean;
    inline: boolean;
    sidebar: boolean;
    inline_every: number;
  };
}

export function getPublicMonetization(): Promise<PublicMonetization> {
  return apiRequest<PublicMonetization>('/api/monetization/public');
}

// ─── Ichki Reklama menejeri ──────────────────────────────────────────────
import type { AdCampaign, AdCampaignBuckets } from '../types/index.ts';

// Frontend: faqat aktiv kampaniyalar, slot bo'yicha guruhlangan.
export function getActiveAds(): Promise<AdCampaignBuckets> {
  return apiRequest<AdCampaignBuckets>('/api/ads/active');
}

// Beholta hisoblagich (impression/click) — xatolikni yashiramiz.
export function trackAdEvent(id: string, event: 'impression' | 'click'): void {
  const body = JSON.stringify({ id, event });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/ads/track', blob);
      return;
    }
  } catch {
    /* fallback quyida */
  }
  fetch('/api/ads/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

// Admin CRUD.
export function adminListAds(): Promise<AdCampaign[]> {
  return apiRequest<AdCampaign[]>('/api/admin/ads');
}

export function adminCreateAd(data: Partial<AdCampaign>): Promise<AdCampaign> {
  return apiRequest<AdCampaign>('/api/admin/ads', { method: 'POST', body: JSON.stringify(data) });
}

export function adminUpdateAd(id: string, data: Partial<AdCampaign>): Promise<AdCampaign> {
  return apiRequest<AdCampaign>(`/api/admin/ads/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function adminDeleteAd(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/api/admin/ads/${id}`, { method: 'DELETE' });
}

export interface WalletInfo {
  balance: number;
  currency: string;
  transactions: any[];
}

export function getWallet(): Promise<WalletInfo> {
  return apiRequest<WalletInfo>('/api/wallet');
}

export function topUpWallet(amount: number, method?: string): Promise<{ success: boolean; balance: number }> {
  return apiRequest('/api/wallet/topup', {
    method: 'POST',
    body: JSON.stringify({ amount, method }),
  });
}

export function promoteListingRequest(listingId: string): Promise<{ success: boolean; listing: any }> {
  return apiRequest(`/api/listings/${listingId}/promote`, { method: 'POST' });
}

// ─── Catalogs / Categories / Attributes (multi-sector) ─────────────────
import type { Catalog, Category, CategoryAttribute } from '../types/index.ts';

export function getCatalogs(): Promise<Catalog[]> {
  return apiRequest<Catalog[]>('/api/catalogs');
}

export function getCategoryTree(catalogId?: string, scope?: string): Promise<Category[]> {
  const params = new URLSearchParams();
  if (catalogId) params.set('catalog_id', catalogId);
  if (scope) params.set('scope', scope);
  const qs = params.toString();
  return apiRequest<Category[]>(`/api/categories/tree${qs ? `?${qs}` : ''}`);
}

export function getCategoryAttributes(categoryId: string): Promise<CategoryAttribute[]> {
  return apiRequest<CategoryAttribute[]>(`/api/categories/${encodeURIComponent(categoryId)}/attributes`);
}

export interface CategoryPopularResult {
  key: string | null;
  label: string;
  items: { value: string; count: number }[];
}

// Kategoriyaga mos "top mashxur" qatori (curate qiymatlar + jonli sonlar).
// Bo'sh `items` => kategoriya uchun mashxur atribut sozlanmagan (reklama sloti).
export function getCategoryPopular(categoryId: string): Promise<CategoryPopularResult> {
  return apiRequest<CategoryPopularResult>(`/api/categories/${encodeURIComponent(categoryId)}/popular`);
}

// ─── Admin Excel import / export (Faza 12) ──────────────────────────────
export async function exportEntityToExcel(entity: string): Promise<void> {
  const token = getStoredToken();
  const response = await fetch(`/api/admin/export/${entity}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Eksportda xatlik');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : `tophand-${entity}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportReport {
  entity: string;
  total: number;
  inserted: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export async function importEntityFromExcel(entity: string, file: File): Promise<ImportReport> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`/api/admin/import/${entity}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Importda xatlik');
  }
  return data as ImportReport;
}
