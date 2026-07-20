import { Link } from 'react-router-dom';
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Live incident log</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => exportIncidentsToCsv(incidents)}>Export CSV</button>
          <Link to="/incidents/new">
            <button>+ New incident</button>
          </Link>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', padding: '0 1rem 1rem' }}>
        <div style={{ flex: 1 }}>
          {loading && <p>Loading…</p>}
          {!loading && sorted.length === 0 && <p>No incidents logged yet.</p>}
          {sorted.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
        <div style={{ width: 220 }}>
          <RadioChannelPanel />
        </div>
      </div>
    </div>
  );
}
