import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, Plus, Settings } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { IncidentCard } from '../components/IncidentCard';
import { EscalationBanner } from '../components/EscalationBanner';
import { RadioChannelPanel } from '../components/RadioChannelPanel';
import { WindConditionsPanel } from '../components/WindConditionsPanel';
import { StatTile } from '../components/StatTile';
import { IncidentFilters, EMPTY_FILTERS, applyIncidentFilters, type IncidentFilterState } from '../components/IncidentFilters';
import { exportIncidentsToCsv } from '../utils/exportCsv';
import { exportIncidentLogToPdf } from '../utils/pdf';

const LEVEL_ORDER: Record<string, number> = { Level4: 0, Level3: 1, Level2: 2, Level1: 3 };

/** Live Board is event-control/fmic/view-only only — Staff gets StaffHome (own-zone list, no map/reports). */
export function LiveBoard() {
  const { user } = useAuth();
  const { activeEvent, loading: eventLoading } = useEvent();
  const { incidents, loading } = useIncidents(activeEvent?.id ?? null);
  const [filters, setFilters] = useState<IncidentFilterState>(EMPTY_FILTERS);
  const [pdfBusy, setPdfBusy] = useState(false);
  const readOnly = user?.role === 'view-only';

  const filtered = useMemo(() => applyIncidentFilters(incidents, filters), [incidents, filters]);

  const sorted = [...filtered].sort((a, b) => {
    const levelDiff = (LEVEL_ORDER[a.escalationLevel] ?? 9) - (LEVEL_ORDER[b.escalationLevel] ?? 9);
    if (levelDiff !== 0) return levelDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const openCount = incidents.filter((i) => i.status === 'Open').length;
  const inProgressCount = incidents.filter((i) => i.status === 'InProgress').length;
  const criticalCount = incidents.filter((i) => (i.escalationLevel === 'Level3' || i.escalationLevel === 'Level4') && i.status !== 'Resolved').length;

  if (!eventLoading && !activeEvent) {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', padding: 'var(--space-4)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-lg)' }}>No event configured</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {user?.role === 'event-control'
            ? 'Set up an event before logging incidents.'
            : 'Event Control needs to set up an event before incidents can be logged.'}
        </p>
        {user?.role === 'event-control' && (
          <Link to="/setup">
            <button type="button">
              <Settings size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              Go to Setup
            </button>
          </Link>
        )}
      </div>
    );
  }

  const downloadPdf = async () => {
    if (!activeEvent) return;
    setPdfBusy(true);
    try {
      await exportIncidentLogToPdf(incidents, activeEvent);
    } finally {
      setPdfBusy(false);
    }
  };

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
        {!readOnly && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="secondary" onClick={() => exportIncidentsToCsv(incidents)}>
              <Download size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              Export CSV
            </button>
            <button type="button" className="secondary" onClick={downloadPdf} disabled={pdfBusy}>
              <FileText size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              {pdfBusy ? 'Preparing…' : 'Export PDF'}
            </button>
            <Link to="/incidents/new">
              <button type="button">
                <Plus size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
                New incident
              </button>
            </Link>
          </div>
        )}
      </div>

      <div className="stat-row" style={{ padding: '0 var(--space-4) var(--space-4)' }}>
        <StatTile label="Open" value={openCount} />
        <StatTile label="In progress" value={inProgressCount} />
        <StatTile label="Active L3/L4" value={criticalCount} accent={criticalCount > 0 ? 'var(--sev-3)' : undefined} />
      </div>

      <IncidentFilters value={filters} onChange={setFilters} />

      <div className="split-layout" style={{ padding: '0 var(--space-4) var(--space-4)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
          {!loading && sorted.length === 0 && incidents.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)' }}>No incidents logged yet.</p>
          )}
          {!loading && sorted.length === 0 && incidents.length > 0 && (
            <p style={{ color: 'var(--color-text-secondary)' }}>No incidents match the current filters.</p>
          )}
          {sorted.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
        <div className="split-layout__side">
          <RadioChannelPanel />
          <WindConditionsPanel />
        </div>
      </div>
    </div>
  );
}
