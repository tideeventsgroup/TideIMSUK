import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { useEvent } from '../context/EventContext';
import { buildHandoverSummary, exportIncidentsToCsv } from '../utils/exportCsv';
import { exportHandoverReportToPdf } from '../utils/pdf';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { IncidentCard } from '../components/IncidentCard';
import { StatTile } from '../components/StatTile';
import { AiSummaryPanel } from '../components/AiSummaryPanel';
import { BreakdownList } from '../components/BreakdownList';

export function Reports() {
  const { activeEvent } = useEvent();
  const { incidents, loading } = useIncidents(activeEvent?.id ?? null);
  const summary = buildHandoverSummary(incidents);
  const [aiSummaryText, setAiSummaryText] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (!activeEvent) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>No event configured yet.</p>;
  }
  if (loading) return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Loading…</p>;

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await exportHandoverReportToPdf({ event: activeEvent, summary, totalLogged: incidents.length, aiSummaryText });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--text-lg)' }}>Shift handover summary</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="secondary" onClick={() => exportIncidentsToCsv(incidents)}>
            <Download size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
            Export CSV
          </button>
          <button type="button" onClick={downloadPdf} disabled={pdfBusy}>
            <FileText size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
            {pdfBusy ? 'Preparing…' : 'Download PDF report'}
          </button>
        </div>
      </div>

      <div className="stat-row" style={{ marginTop: 'var(--space-4)' }}>
        <StatTile label="Open" value={summary.totalOpen} />
        <StatTile label="In progress" value={summary.totalInProgress} />
        <StatTile label="Total logged" value={incidents.length} />
      </div>

      <BreakdownList title="By category" entries={Object.entries(summary.byCategory)} labeler={categoryLabel} />
      <BreakdownList title="By zone" entries={Object.entries(summary.byZone)} labeler={zoneLabel} />

      <AiSummaryPanel summary={summary} totalLogged={incidents.length} onGenerated={setAiSummaryText} />

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Level 3/4 incidents</h2>
      {summary.criticalOrMajor.length === 0 && <p style={{ color: 'var(--color-text-tertiary)' }}>None.</p>}
      {summary.criticalOrMajor.map((i) => (
        <IncidentCard key={i.id} incident={i} />
      ))}
    </div>
  );
}
