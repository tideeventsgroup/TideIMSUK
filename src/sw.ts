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
      });
      // Service workers can't play audio themselves — tell every open tab
      // to sound the siren instead. No effect if the app isn't open anywhere;
      // the OS/browser's own notification sound is the only audible alert then.
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
