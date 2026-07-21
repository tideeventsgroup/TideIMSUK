import { useEffect, useState } from 'react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { categoryLabel } from '../constants/taxonomy';
import { escalationDef } from '../constants/escalation';
import { StatTile } from '../components/StatTile';
import { BreakdownList } from '../components/BreakdownList';
import type { Incident } from '../types/incident';

function tally<T extends string>(values: T[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function avgResolutionMinutes(incidents: Incident[]): number | null {
  const resolved = incidents.filter((i) => i.status === 'Resolved' && i.resolvedAt);
  if (resolved.length === 0) return null;
  const totalMs = resolved.reduce((sum, i) => sum + (new Date(i.resolvedAt!).getTime() - new Date(i.timestamp).getTime()), 0);
  return Math.round(totalMs / resolved.length / 60000);
}

export function Analytics() {
  const { user } = useAuth();
  const { events, loading: eventsLoading } = useEvent();
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    client.models.Incident.list().then(({ data }) => {
      if (!cancelled) {
        setAllIncidents(data as unknown as Incident[]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (user && user.role !== 'event-control' && user.role !== 'fmic') {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Not authorised.</p>;
  }
  if (loading || eventsLoading) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Loading…</p>;
  }

  const majorOrCritical = allIncidents.filter((i) => i.escalationLevel === 'Level3' || i.escalationLevel === 'Level4');
  const overallAvgResolution = avgResolutionMinutes(allIncidents);

  const byEvent = [...events]
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
    .map((event) => {
      const incidents = allIncidents.filter((i) => i.eventId === event.id);
      return {
        event,
        incidents,
        majorOrCritical: incidents.filter((i) => i.escalationLevel === 'Level3' || i.escalationLevel === 'Level4').length,
        avgResolution: avgResolutionMinutes(incidents),
      };
    });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-lg)' }}>Cross-event analytics</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        Incident history across every event, for planning and risk register tuning.
      </p>

      <div className="stat-row" style={{ marginTop: 'var(--space-4)' }}>
        <StatTile label="Events" value={events.length} />
        <StatTile label="Incidents logged" value={allIncidents.length} />
        <StatTile label="Level 3/4" value={majorOrCritical.length} />
        <StatTile label="Avg resolution (min)" value={overallAvgResolution ?? 0} />
      </div>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>By event</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
              <th style={{ padding: 'var(--space-2)' }}>Event</th>
              <th style={{ padding: 'var(--space-2)' }}>Dates</th>
              <th style={{ padding: 'var(--space-2)', textAlign: 'right' }}>Incidents</th>
              <th style={{ padding: 'var(--space-2)', textAlign: 'right' }}>L3/4</th>
              <th style={{ padding: 'var(--space-2)', textAlign: 'right' }}>Avg resolution</th>
            </tr>
          </thead>
          <tbody>
            {byEvent.map(({ event, incidents, majorOrCritical, avgResolution }) => (
              <tr key={event.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: 'var(--space-2)' }}>{event.name}</td>
                <td className="mono" style={{ padding: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                  {event.startDate}
                </td>
                <td className="mono" style={{ padding: 'var(--space-2)', textAlign: 'right' }}>
                  {incidents.length}
                </td>
                <td className="mono" style={{ padding: 'var(--space-2)', textAlign: 'right' }}>
                  {majorOrCritical}
                </td>
                <td className="mono" style={{ padding: 'var(--space-2)', textAlign: 'right' }}>
                  {avgResolution !== null ? `${avgResolution}m` : '—'}
                </td>
              </tr>
            ))}
            {byEvent.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-2)', color: 'var(--color-text-tertiary)' }}>
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BreakdownList
        title="By category (all events)"
        entries={tally(allIncidents.map((i) => i.category))}
        labeler={(k) => categoryLabel(k as Incident['category'])}
      />
      <BreakdownList
        title="By escalation level (all events)"
        entries={tally(allIncidents.map((i) => i.escalationLevel))}
        labeler={(k) => escalationDef(k)?.name ?? k}
      />
    </div>
  );
}
