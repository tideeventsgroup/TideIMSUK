import { useEffect, useState } from 'react';
import { client } from '../data/client';
import type { Incident } from '../types/incident';

/**
 * Live incident feed via AppSync subscriptions — every device sees a new
 * incident or update the instant it's logged, no polling (Build Plan
 * Section 2/6).
 */
export function useIncidents(eventId: string) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const { data } = await client.models.Incident.list({ filter: { eventId: { eq: eventId } } });
      if (!cancelled) {
        setIncidents(data as unknown as Incident[]);
        setLoading(false);
      }
    }
    loadInitial();

    const createSub = client.models.Incident.onCreate({ filter: { eventId: { eq: eventId } } }).subscribe({
      next: (incident) => {
        setIncidents((prev) => [incident as unknown as Incident, ...prev.filter((i) => i.id !== incident.id)]);
      },
    });

    const updateSub = client.models.Incident.onUpdate({ filter: { eventId: { eq: eventId } } }).subscribe({
      next: (incident) => {
        setIncidents((prev) =>
          prev.map((i) => (i.id === incident.id ? (incident as unknown as Incident) : i)),
        );
      },
    });

    return () => {
      cancelled = true;
      createSub.unsubscribe();
      updateSub.unsubscribe();
    };
  }, [eventId]);

  return { incidents, loading };
}
