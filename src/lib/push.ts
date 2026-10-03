import { apiRequest } from './api.ts';

/** Convert a VAPID applicationServerKey (base64url) to the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output as Uint8Array<ArrayBuffer>;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function getPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Faqat brauzer Notification ruxsatini so'raydi (obuna emas — auth talab qilmaydi).
 * Qaror hali berilmagan ('default') bo'lsa prompt chiqaradi; aks holda joriy holatni qaytaradi.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (getPermission() !== 'default') return getPermission();
  try {
    return await Notification.requestPermission();
  } catch {
    return getPermission();
  }
}

let registering: Promise<ServiceWorkerRegistration> | null = null;

/** Register (once) and return the TopHand service worker registration. */
export function registerSW(): Promise<ServiceWorkerRegistration> {
  if (!registering) {
    registering = navigator.serviceWorker.register('/sw.js');
  }
  return registering;
}

export type EnablePushResult = 'ok' | 'unsupported' | 'denied' | 'disabled' | 'error';

/** Ask permission, subscribe via the SW, and store the subscription server-side. */
export async function enablePush(): Promise<EnablePushResult> {
  if (!isPushSupported()) return 'unsupported';
  try {
    await registerSW();
    if (getPermission() === 'denied') return 'denied';
    if (getPermission() !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return 'denied';
    }

    const { key, enabled } = await apiRequest<{ key: string; enabled: boolean }>('/api/push/public-key');
    if (!enabled || !key) return 'disabled';

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    await apiRequest('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
    return 'ok';
  } catch (err) {
    console.error('enablePush failed:', err);
    return 'error';
  }
}

/** Unsubscribe this browser and remove it from the server. */
export async function disablePush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiRequest('/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}
