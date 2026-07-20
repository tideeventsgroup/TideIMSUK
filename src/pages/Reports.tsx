import { Download } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { buildHandoverSummary, exportIncidentsToCsv } from '../utils/exportCsv';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { IncidentCard } from '../components/IncidentCard';

const DEFAULT_EVENT_ID = import.meta.env.VITE_EVENT_ID ?? 'default-event';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        flex: 1,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        background: 'var(--color-surface-raised)',
        textAlign: 'center',
      }}
    >
      <div className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function BreakdownList({ title, entries, labeler }: { title: string; entries: [string, number][]; labeler: (k: string) => string }) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-base)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 160, fontSize: 'var(--text-sm)', flexShrink: 0 }}>{labeler(k)}</div>
            <div style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', height: 8 }}>
              <div
                style={{
                  width: `${(v / max) * 100}%`,
                  background: 'var(--color-accent)',
                  height: '100%',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </div>
            <div className="mono" style={{ width: 24, textAlign: 'right', fontSize: 'var(--text-sm)' }}>
              {v}
            </div>
          </div>
        ))}
        {entries.length === 0 && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>None.</p>}
      </div>
    </div>
  );
}

export function Reports() {
  const { incidents, loading } = useIncidents(DEFAULT_EVENT_ID);
  const summary = buildHandoverSummary(incidents);

  if (loading) return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--text-lg)' }}>Shift handover summary</h1>
        <button type="button" className="secondary" onClick={() => exportIncidentsToCsv(incidents)}>
          <Download size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
          Export full log to CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <StatTile label="Open" value={summary.totalOpen} />
        <StatTile label="In progress" value={summary.totalInProgress} />
        <StatTile label="Total logged" value={incidents.length} />
      </div>

      <BreakdownList title="By category" entries={Object.entries(summary.byCategory)} labeler={categoryLabel} />
      <BreakdownList title="By zone" entries={Object.entries(summary.byZone)} labeler={zoneLabel} />

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Level 3/4 incidents</h2>
      {summary.criticalOrMajor.length === 0 && <p style={{ color: 'var(--color-text-tertiary)' }}>None.</p>}
      {summary.criticalOrMajor.map((i) => (
        <IncidentCard key={i.id} incident={i} />
      ))}
    </div>
  );
}
