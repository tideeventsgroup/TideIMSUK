/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  const payload = event.data.json() as { title: string; body: string; url?: string; urgent?: boolean; alarm?: boolean };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: payload.url ?? '/' },
        // Level 3/4 escalations pin until dismissed; routine logging notifications
        // (new incident, status change, update added) auto-dismiss like normal.
        requireInteraction: payload.urgent ?? false,
        // Level 4 only: a long, distinct vibration pattern (supported on
        // Android; iOS/desktop ignore it) — the one signal that reaches a
        // device with the app fully closed, alongside the OS's own default
        // notification sound (silent is never set, so that always plays).
        ...(payload.alarm ? { vibrate: [400, 200, 400, 200, 400, 200, 800] } : {}),
      });
      // Service workers can't play audio themselves — tell every open tab
      // to sound the real siren instead (see AlarmListener.tsx). No effect
      // if the app isn't open anywhere; a closed app only ever gets the
      // vibration above plus the OS's default notification sound — the Web
      // Notifications API has no way to attach a custom sound file, closed
      // or open, and a service worker has no audio API at all.
      if (payload.alarm) {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) client.postMessage({ type: 'PLAY_ALARM' });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) {
        existing.focus();
        if ('navigate' in existing) (existing as WindowClient).navigate(url);
        return;
      }
      self.clients.openWindow(url);
    })
  );
});

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());
