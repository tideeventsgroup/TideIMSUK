import { useEffect, useState } from 'react';
import { flushQueue, subscribeQueue, type QueuedIncident } from '../offline/queue';

export function OfflineQueueBadge() {
  const [queue, setQueue] = useState<QueuedIncident[]>([]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsub = subscribeQueue(setQueue);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online && queue.length === 0) return null;

  return (
    <div
      style={{
        background: online ? '#d97706' : '#7c2d12',
        color: '#fff',
        padding: '0.4rem 1rem',
        fontSize: '0.85rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span>
        {!online && 'Offline — writes are queued locally. '}
        {queue.length > 0 && `${queue.length} incident${queue.length > 1 ? 's' : ''} pending sync.`}
      </span>
      {online && queue.length > 0 && (
        <button onClick={() => void flushQueue()} style={{ marginLeft: '0.5rem' }}>
          Retry sync
        </button>
      )}
    </div>
  );
}
