import React, { createContext, useContext, useState, useEffect } from 'react';
import { Notification } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import { useAuth } from './AuthContext.tsx';
import {
  isPushSupported,
  getPermission,
  registerSW,
  enablePush as enablePushLib,
  disablePush as disablePushLib,
} from '../lib/push.ts';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  // Web Push (browser notifications, work even when the site is closed)
  pushSupported: boolean;
  pushPermission: NotificationPermission;
  pushEnabled: boolean;
  isEnablingPush: boolean;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(getPermission());
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [isEnablingPush, setIsEnablingPush] = useState<boolean>(false);
  const pushSupported = isPushSupported();

  // Register the service worker once on mount (harmless if already registered).
  useEffect(() => {
    if (pushSupported) registerSW().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect the browser permission whenever it may have changed.
  useEffect(() => {
    setPushPermission(getPermission());
  }, [user]);

  // Ask the server whether this user has an active subscription.
  useEffect(() => {
    if (!user) {
      setPushEnabled(false);
      return;
    }
    apiRequest<{ subscribed: boolean }>('/api/push/status')
      .then((r) => setPushEnabled(Boolean(r.subscribed)))
      .catch(() => setPushEnabled(false));
  }, [user]);

  const refreshNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const data = await apiRequest<{ notifications: Notification[]; unread_count: number }>(
        '/api/notifications'
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [user]);

  const markAllAsRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const enablePush = async () => {
    setIsEnablingPush(true);
    try {
      const res = await enablePushLib();
      setPushPermission(getPermission());
      if (res === 'ok') {
        setPushEnabled(true);
      } else if (res === 'denied') {
        throw new Error('Bildirishnomaga ruxsat berilmadi. Brauzer sozlamalaridan yoqing.');
      } else if (res === 'disabled') {
        throw new Error('Server tomonida push yoqilmagan (VAPID kalitlari sozlanmagan).');
      } else if (res === 'unsupported') {
        throw new Error('Brauzeringiz push bildirishnomalarni qo‘llab-quvvatlamaydi.');
      } else {
        throw new Error('Bildirishnomani yoqib bo‘lmadi.');
      }
    } finally {
      setIsEnablingPush(false);
    }
  };

  const disablePush = async () => {
    setIsEnablingPush(true);
    try {
      await disablePushLib();
      setPushEnabled(false);
    } finally {
      setIsEnablingPush(false);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        refreshNotifications,
        markAllAsRead,
        markAsRead,
        pushSupported,
        pushPermission,
        pushEnabled,
        isEnablingPush,
        enablePush,
        disablePush,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
