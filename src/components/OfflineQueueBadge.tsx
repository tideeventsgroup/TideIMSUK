import { useEffect, useState } from 'react';
import { WifiOff, UploadCloud } from 'lucide-react';
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
      role="status"
      style={{
        background: online ? 'var(--sev-2)' : 'var(--sev-4-solid)',
        color: '#ffffff',
        padding: 'var(--space-2) var(--space-4)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
    >
      {online ? <UploadCloud size={16} /> : <WifiOff size={16} />}
      <span>
        {!online && 'Offline — writes are queued locally. '}
        {queue.length > 0 && `${queue.length} incident${queue.length > 1 ? 's' : ''} pending sync.`}
      </span>
      {online && queue.length > 0 && (
        <button onClick={() => void flushQueue()} className="secondary" style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.4)', color: '#fff', minHeight: 28, padding: '0 var(--space-3)' }}>
          Retry sync
        </button>
      )}
    </div>
  );
}
