import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { client } from '../data/client';
import type { EventInfo } from '../types/event';

const STORAGE_KEY = 'tide-ims-active-event';

interface EventCtxValue {
  events: EventInfo[];
  activeEvent: EventInfo | null;
  loading: boolean;
  setActiveEventId: (id: string) => void;
  refresh: () => Promise<void>;
}

const EventCtx = createContext<EventCtxValue>({
  events: [],
  activeEvent: null,
  loading: true,
  setActiveEventId: () => {},
  refresh: async () => {},
});

/**
 * Which Event is "live" is a per-device choice, not a build-time constant —
 * a solo operator running multiple engagements needs to switch between
 * them from the Setup page rather than editing an env var and redeploying.
 */
export function EventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [activeEventId, setActiveEventIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.models.Event.list();
      const list = (data as unknown as EventInfo[]).sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
      setEvents(list);
      setActiveEventIdState((current) => {
        if (current && list.some((e) => e.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveEventId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveEventIdState(id);
  };

  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;

  return (
    <EventCtx.Provider value={{ events, activeEvent, loading, setActiveEventId, refresh }}>{children}</EventCtx.Provider>
  );
}

export function useEvent() {
  return useContext(EventCtx);
}
