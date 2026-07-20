import { client } from '../data/client';

/**
 * Local-first write queue for incident creation while offline (Build Plan
 * Section 2/4 — background sync queue, relevant for Stranraer/Breastworks
 * signal). Writes made offline queue in localStorage and flush automatically
 * on reconnect; logging is never blocked by connectivity.
 */

const STORAGE_KEY = 'tide-ims-offline-queue';

export interface QueuedIncident {
  localId: string;
  payload: Record<string, unknown>;
  queuedAt: string;
}

type Listener = (queue: QueuedIncident[]) => void;
const listeners = new Set<Listener>();

function readQueue(): QueuedIncident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedIncident[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedIncident[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  listeners.forEach((l) => l(queue));
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener(readQueue());
  return () => listeners.delete(listener);
}

export function getQueue(): QueuedIncident[] {
  return readQueue();
}

export function enqueueIncident(payload: Record<string, unknown>): QueuedIncident {
  const item: QueuedIncident = {
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    queuedAt: new Date().toISOString(),
  };
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
}

let flushing = false;

/** Attempts to send every queued incident. Stops on first network failure, leaving the rest queued. */
export async function flushQueue(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    let queue = readQueue();
    while (queue.length > 0) {
      const [next, ...rest] = queue;
      try {
        await client.models.Incident.create(next.payload as never);
        queue = rest;
        writeQueue(queue);
      } catch {
        // Network or server error — stop here, retry on next flush trigger.
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

export function initOfflineSync(): () => void {
  const onOnline = () => void flushQueue();
  window.addEventListener('online', onOnline);
  if (navigator.onLine) void flushQueue();
  return () => window.removeEventListener('online', onOnline);
}
