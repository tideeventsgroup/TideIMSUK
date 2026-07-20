import { Link } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { IncidentCard } from '../components/IncidentCard';
import { EscalationBanner } from '../components/EscalationBanner';
import { RadioChannelPanel } from '../components/RadioChannelPanel';
import { exportIncidentsToCsv } from '../utils/exportCsv';

const DEFAULT_EVENT_ID = import.meta.env.VITE_EVENT_ID ?? 'default-event';

const LEVEL_ORDER: Record<string, number> = { Level4: 0, Level3: 1, Level2: 2, Level1: 3 };

export function LiveBoard() {
  const { incidents, loading } = useIncidents(DEFAULT_EVENT_ID);

  const sorted = [...incidents].sort((a, b) => {
    const levelDiff = (LEVEL_ORDER[a.escalationLevel] ?? 9) - (LEVEL_ORDER[b.escalationLevel] ?? 9);
    if (levelDiff !== 0) return levelDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div>
      <EscalationBanner incidents={incidents} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-4)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: 'var(--text-lg)' }}>Live incident log</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="secondary" onClick={() => exportIncidentsToCsv(incidents)}>
            <Download size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
            Export CSV
          </button>
          <Link to="/incidents/new">
            <button type="button">
              <Plus size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              New incident
            </button>
          </Link>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-4)', padding: '0 var(--space-4) var(--space-4)', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
          {!loading && sorted.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)' }}>No incidents logged yet.</p>
          )}
          {sorted.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
        <div style={{ width: 220, flexShrink: 0 }}>
          <RadioChannelPanel />
        </div>
      </div>
    </div>
  );
}
