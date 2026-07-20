import { useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { client } from '../data/client';
import { CATEGORIES, categoryLabel, type CategoryKey } from '../constants/taxonomy';
import { ZONES, zoneLabel, type ZoneKey } from '../constants/zones';
import { escalationDef, type EscalationLevelKey } from '../constants/escalation';

interface Suggestion {
  category: CategoryKey | null;
  zone: ZoneKey | null;
  level: EscalationLevelKey | null;
  rationale: string | null;
}

/**
 * Triage-assist (Build Plan Section 11): suggests category/zone/level from
 * the free-text narrative as the Loggist types. Suggestion only — the
 * Loggist always confirms or dismisses, it's never applied automatically,
 * and it never touches escalation level (only Controller/Admin declare
 * that, from the incident page after creation).
 */
export function TriageSuggest({
  narrative,
  onApply,
}: {
  narrative: string;
  onApply: (fields: { category?: CategoryKey; zone?: ZoneKey }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const { data, errors } = await client.queries.triageAssist({ narrative });
      if (errors?.length) throw new Error(errors[0].message);
      const category = CATEGORIES.find((c) => c.key === data?.suggestedCategory)?.key ?? null;
      const zone = ZONES.find((z) => z.key === data?.suggestedZone)?.key ?? null;
      const level = (data?.suggestedLevel as EscalationLevelKey) ?? null;
      setSuggestion({ category, zone, level: escalationDef(level ?? '') ? level : null, rationale: data?.rationale ?? null });
    } catch {
      setError('AI suggestion unavailable right now — log the incident manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" className="secondary" onClick={ask} disabled={loading || narrative.trim().length < 10}>
        <Sparkles size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
        {loading ? 'Thinking…' : 'Suggest with AI'}
      </button>

      {error && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{error}</p>
      )}

      {suggestion && (suggestion.category || suggestion.zone || suggestion.level) && (
        <div
          style={{
            marginTop: 'var(--space-2)',
            border: '1px solid var(--color-brand)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--color-brand)' }}>
            <Sparkles size={14} /> AI suggests
          </div>
          <div style={{ marginTop: 4 }}>
            {suggestion.category && <>Category: <strong>{categoryLabel(suggestion.category)}</strong>. </>}
            {suggestion.zone && <>Zone: <strong>{zoneLabel(suggestion.zone)}</strong>. </>}
            {suggestion.level && (
              <>
                Suggested level: <strong>{escalationDef(suggestion.level)?.name}</strong> (Controller/Admin declares after review).
              </>
            )}
          </div>
          {suggestion.rationale && (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 4 }}>{suggestion.rationale}</p>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {(suggestion.category || suggestion.zone) && (
              <button
                type="button"
                onClick={() => {
                  onApply({ category: suggestion.category ?? undefined, zone: suggestion.zone ?? undefined });
                  setSuggestion(null);
                }}
              >
                <Check size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                Apply category/zone
              </button>
            )}
            <button type="button" className="secondary" onClick={() => setSuggestion(null)}>
              <X size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
