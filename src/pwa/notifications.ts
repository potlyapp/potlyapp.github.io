import type { NotificationPermissionState } from '../domain/notify';

export function notificationPermission(): NotificationPermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

/** Prefers the service worker (works on Android Chrome where `new Notification` throws); falls back to the page. */
export async function showNotification(title: string, body: string): Promise<void> {
  const options: NotificationOptions = { body, lang: 'fa', dir: 'rtl', tag: 'potly-daily', icon: '/icon-192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // fall through to the page-level API
  }
  new Notification(title, options);
}
