'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type NotificationPermission = 'default' | 'granted' | 'denied';

interface NotificationBellProps {
  isDark?: boolean;
}

const STORAGE_KEY = 'sipbd-push-subscription';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationBell({ isDark = true }: NotificationBellProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [supported, setSupported] = useState(true);

  // Check if push notifications are supported
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(isSupported);
    if (!isSupported) return;

    // Check current permission
    if ('Notification' in window) {
      setPermission(Notification.permission as NotificationPermission);
    }

    // Check if already subscribed
    checkSubscription();
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        setIsSubscribed(true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          endpoint: subscription.endpoint,
        }));
      } else {
        setIsSubscribed(false);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // SW not ready yet
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notification-bell]')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showDropdown]);

  const subscribe = async () => {
    if (!supported) return;
    setIsLoading(true);

    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm as NotificationPermission);

      if (perm !== 'granted') {
        setIsLoading(false);
        return;
      }

      // Get VAPID public key
      const keyRes = await fetch('/api/notifications/vapid-public-key');
      const keyData = await keyRes.json();
      if (!keyData.publicKey) {
        console.error('Failed to get VAPID public key');
        setIsLoading(false);
        return;
      }

      // Register service worker if not already
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      // Send subscription to server
      const subJson = subscription.toJSON();
      const saveRes = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userId: 'admin',
        }),
      });

      if (saveRes.ok) {
        setIsSubscribed(true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          endpoint: subJson.endpoint,
        }));
      } else {
        console.error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        // Remove from server
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        // Unsubscribe from push manager
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      localStorage.removeItem(STORAGE_KEY);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error unsubscribing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setTestStatus('sending');
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🔔 Test Notifikasi SIPBD',
          body: 'Notifikasi push berhasil diaktifkan! Anda akan menerima pemberitahuan saat ada registrasi KUSUKA baru.',
          url: '/',
          secret: 'sipbd-internal-2024',
        }),
      });

      if (res.ok) {
        setTestStatus('sent');
        setTimeout(() => setTestStatus('idle'), 3000);
      } else {
        setTestStatus('error');
        setTimeout(() => setTestStatus('idle'), 3000);
      }
    } catch {
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  if (!supported) {
    return (
      <button
        className="w-10 h-10 flex items-center justify-center rounded-xl opacity-40 cursor-not-allowed"
        title="Push notifications tidak didukung di browser ini"
        style={{
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        }}
      >
        <BellOff size={16} style={{ color: 'var(--muted-foreground)' }} />
      </button>
    );
  }

  // Determine bell appearance
  const getBellIcon = () => {
    if (isLoading) return <Loader2 size={16} className="animate-spin" />;
    if (permission === 'denied') return <BellOff size={16} />;
    if (isSubscribed) return <BellRing size={16} />;
    return <Bell size={16} />;
  };

  const getBellColor = () => {
    if (permission === 'denied') return '#EF4444'; // red
    if (isSubscribed) return '#06B6D4'; // teal/cyan
    return 'var(--muted-foreground)';
  };

  const getBellBg = () => {
    if (permission === 'denied') {
      return isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)';
    }
    if (isSubscribed) {
      return isDark ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)';
    }
    return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,182,212,0.08)';
  };

  const getBellBorder = () => {
    if (permission === 'denied') {
      return isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)';
    }
    if (isSubscribed) {
      return isDark ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.2)';
    }
    return isDark ? 'rgba(255,255,255,0.1)' : 'rgba(6,182,212,0.15)';
  };

  return (
    <div className="relative" data-notification-bell>
      <button
        onClick={() => {
          if (!isSubscribed && permission !== 'denied') {
            subscribe();
          } else {
            setShowDropdown(!showDropdown);
          }
        }}
        className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
        title={
          permission === 'denied'
            ? 'Notifikasi diblokir'
            : isSubscribed
              ? 'Notifikasi aktif'
              : 'Aktifkan notifikasi'
        }
        style={{
          background: getBellBg(),
          border: `1px solid ${getBellBorder()}`,
        }}
      >
        <span style={{ color: getBellColor() }}>{getBellIcon()}</span>
        {isSubscribed && !isLoading && (
          <span
            className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#06B6D4' }}
          />
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden z-50"
          style={{
            background: isDark ? '#0D1B2E' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div className="p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: isSubscribed
                      ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                      : isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.06)',
                    boxShadow: isSubscribed ? '0 2px 8px rgba(6,182,212,0.3)' : 'none',
                  }}
                >
                  {isSubscribed ? (
                    <BellRing className="h-4 w-4 text-white" />
                  ) : (
                    <BellOff className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: isSubscribed ? '#06B6D4' : 'var(--foreground)' }}>
                    {isSubscribed ? 'Notifikasi Aktif' : 'Notifikasi Nonaktif'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {permission === 'denied'
                      ? 'Diblokir oleh browser'
                      : isSubscribed
                        ? 'Anda akan menerima pemberitahuan'
                        : 'Klik bell untuk mengaktifkan'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Divider */}
            <div
              className="h-px"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
            />

            {/* Actions */}
            {permission === 'denied' ? (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Notifikasi diblokir oleh browser. Untuk mengaktifkan, ubah pengaturan notifikasi di browser Anda.
                </p>
              </div>
            ) : isSubscribed ? (
              <div className="space-y-2">
                <Button
                  onClick={sendTestNotification}
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-2"
                  disabled={testStatus === 'sending'}
                >
                  {testStatus === 'sending' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : testStatus === 'sent' ? (
                    <span className="text-emerald-500">✓ Terkirim!</span>
                  ) : testStatus === 'error' ? (
                    <span className="text-red-400">Gagal</span>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Kirim Test Notifikasi
                    </>
                  )}
                </Button>
                <button
                  onClick={unsubscribe}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  disabled={isLoading}
                >
                  <BellOff className="h-3.5 w-3.5" />
                  Berhenti Berlangganan
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Aktifkan notifikasi untuk mendapatkan pemberitahuan saat ada registrasi KUSUKA baru.
                </p>
                <Button
                  onClick={subscribe}
                  size="sm"
                  className="w-full h-8 text-xs gap-2"
                  disabled={isLoading}
                  style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Bell className="h-3.5 w-3.5" />
                      Aktifkan Notifikasi
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
