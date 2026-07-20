import { useIncidents } from '../hooks/useIncidents';
import { buildHandoverSummary, exportIncidentsToCsv } from '../utils/exportCsv';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { IncidentCard } from '../components/IncidentCard';

const DEFAULT_EVENT_ID = import.meta.env.VITE_EVENT_ID ?? 'default-event';

export function Reports() {
  const { incidents, loading } = useIncidents(DEFAULT_EVENT_ID);
  const summary = buildHandoverSummary(incidents);

  if (loading) return <p style={{ padding: '1rem' }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: '1.25rem' }}>Shift handover summary</h1>
      <button onClick={() => exportIncidentsToCsv(incidents)}>Export full log to CSV</button>

      <p>
        {summary.totalOpen} open, {summary.totalInProgress} in progress, {incidents.length} total logged.
      </p>

      <h2 style={{ fontSize: '1rem' }}>By category</h2>
      <ul>
        {Object.entries(summary.byCategory).map(([k, v]) => (
          <li key={k}>
            {categoryLabel(k)}: {v}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: '1rem' }}>By zone</h2>
      <ul>
        {Object.entries(summary.byZone).map(([k, v]) => (
          <li key={k}>
            {zoneLabel(k)}: {v}
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: '1rem' }}>Level 3/4 incidents</h2>
      {summary.criticalOrMajor.length === 0 && <p>None.</p>}
      {summary.criticalOrMajor.map((i) => (
        <IncidentCard key={i.id} incident={i} />
      ))}
    </div>
  );
}
