import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { IncidentCard } from '../components/IncidentCard';
import { EscalationBanner } from '../components/EscalationBanner';

const LEVEL_ORDER: Record<string, number> = { Level4: 0, Level3: 1, Level2: 2, Level1: 3 };

/**
 * Deliberately minimal — the Staff PWA is Incidents + Messaging only, no
 * dashboard/map/reports clutter, so it stays fast and light across a
 * 3-day event. Scoped to the Staff member's own assigned zone (client-side
 * only — see the note in amplify/data/resource.ts).
 */
export function StaffHome() {
  const { user } = useAuth();
  const { activeEvent, loading: eventLoading } = useEvent();
  const { incidents: allIncidents, loading } = useIncidents(activeEvent?.id ?? null);

  const incidents = user?.assignedZone
    ? allIncidents.filter((i) => i.zone === user.assignedZone || i.zone === 'WholeSite')
    : allIncidents;

  const open = incidents
    .filter((i) => i.status !== 'Resolved')
    .sort((a, b) => {
      const levelDiff = (LEVEL_ORDER[a.escalationLevel] ?? 9) - (LEVEL_ORDER[b.escalationLevel] ?? 9);
      if (levelDiff !== 0) return levelDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  if (!eventLoading && !activeEvent) {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        No event configured yet — Event Control needs to set one up before incidents can be logged.
      </p>
    );
  }

  return (
    <div>
      <EscalationBanner incidents={incidents} />
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--text-lg)' }}>Incidents{user?.assignedZone ? ' — your zone' : ''}</h1>
        </div>

        <Link to="/incidents/new" style={{ display: 'block', marginBottom: 'var(--space-4)' }}>
          <button type="button" style={{ width: '100%', minHeight: 52, fontSize: 'var(--text-base)' }}>
            <Plus size={16} style={{ marginRight: 8, verticalAlign: -3 }} />
            New incident
          </button>
        </Link>

        {!user?.assignedZone && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)' }}>
            Set your zone above to see only incidents relevant to you.
          </p>
        )}

        {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
        {!loading && open.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>No open incidents.</p>}
        {open.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>
    </div>
  );
}
