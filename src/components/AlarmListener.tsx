import { useEffect } from 'react';
import { playAlarmSound } from '../utils/alarmSound';

/** Mounted once at app root — sounds the siren when the service worker relays a Level 4 push. */
export function AlarmListener() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_ALARM') playAlarmSound();
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  return null;
}
