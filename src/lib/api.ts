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

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

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
}

export function getPublicMonetization(): Promise<PublicMonetization> {
  return apiRequest<PublicMonetization>('/api/monetization/public');
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
