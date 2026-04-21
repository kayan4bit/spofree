import type { Track } from '../types';

const ENABLED_KEY = 'atomic_desktop_notifications_v1';

export const notificationService = {
  isEnabled(): boolean {
    try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch { return false; }
  },
  setEnabled(v: boolean) {
    try { localStorage.setItem(ENABLED_KEY, String(v)); } catch {}
  },
};

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

let lastId: string | number | null = null;
let current: Notification | null = null;

export function notifyTrack(track: Track) {
  if (!notificationService.isEnabled()) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return; // Don't nag while the tab is focused
  if (lastId === track.id) return;
  lastId = track.id;

  try {
    current?.close();
    current = new Notification(track.title, {
      body: `${track.artist.name} — ${track.album.title}`,
      icon: track.album.cover,
      badge: track.album.cover,
      tag: 'atomic-now-playing',
      silent: true,
    });
    current.onclick = () => {
      window.focus();
      current?.close();
    };
  } catch {}
}
