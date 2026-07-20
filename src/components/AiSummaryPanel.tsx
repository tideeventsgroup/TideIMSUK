import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { client } from '../data/client';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { escalationDef } from '../constants/escalation';
import type { Incident } from '../types/incident';

interface HandoverSummary {
  totalOpen: number;
  totalInProgress: number;
  byCategory: Record<string, number>;
  byZone: Record<string, number>;
  criticalOrMajor: Incident[];
}

/** AI-drafted shift handover summary (Build Plan Section 11) — a draft for a human to review, not a decision. */
export function AiSummaryPanel({ summary, totalLogged }: { summary: HandoverSummary; totalLogged: number }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setText(null);
    try {
      const payload = {
        totalLogged,
        totalOpen: summary.totalOpen,
        totalInProgress: summary.totalInProgress,
        byCategory: Object.fromEntries(Object.entries(summary.byCategory).map(([k, v]) => [categoryLabel(k), v])),
        byZone: Object.fromEntries(Object.entries(summary.byZone).map(([k, v]) => [zoneLabel(k), v])),
        openLevel3And4: summary.criticalOrMajor.map((i) => ({
          level: escalationDef(i.escalationLevel)?.name,
          category: categoryLabel(i.category),
          zone: zoneLabel(i.zone),
          status: i.status,
          narrative: i.narrative,
        })),
      };
      const { data, errors } = await client.queries.shiftSummary({ summaryJson: JSON.stringify(payload) });
      if (errors?.length) throw new Error(errors[0].message);
      setText(data ?? '');
    } catch {
      setError('AI summary unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-base)', margin: 0 }}>AI shift summary</h2>
        <button type="button" className="secondary" onClick={generate} disabled={loading}>
          <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {loading ? 'Drafting…' : text ? 'Regenerate' : 'Generate'}
        </button>
      </div>
      {error && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>{error}</p>}
      {text && (
        <div
          style={{
            marginTop: 'var(--space-2)',
            border: '1px solid var(--color-brand)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)', marginBottom: 0 }}>
            AI-drafted from the structured log above — review before including in the debrief pack.
          </p>
        </div>
      )}
    </div>
  );
}
