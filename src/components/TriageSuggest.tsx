import { useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { client } from '../data/client';
import { CATEGORIES, categoryLabel, type CategoryKey } from '../constants/taxonomy';
import { ZONES, zoneLabel, type ZoneKey } from '../constants/zones';
import { escalationDef, type EscalationLevelKey } from '../constants/escalation';
import type { Priority } from '../types/incident';

export interface AppliedFields {
  category?: CategoryKey;
  subcategory?: string;
  zone?: ZoneKey;
  priority?: Priority;
  radioChannel?: number;
  assignedAgency?: string;
  riskRefs?: string[];
  narrative?: string;
}

interface Suggestion {
  category: CategoryKey | null;
  subcategory: string | null;
  zone: ZoneKey | null;
  level: EscalationLevelKey | null;
  priority: Priority | null;
  radioChannel: number | null;
  assignedAgency: string | null;
  riskRefs: string[];
  narrativeSummary: string | null;
  rationale: string | null;
}

/**
 * Triage-assist (Build Plan Section 11): drafts the whole incident form from a
 * rough free-text narrative as the Loggist types. Suggestion only — nothing is
 * applied until the Loggist reviews and clicks Apply, and it never touches
 * escalation level (only Controller/Admin declare that, from the incident page
 * after creation).
 */
export function TriageSuggest({
  narrative,
  riskContext,
  onApply,
}: {
  narrative: string;
  riskContext: { ref: string; hazard: string }[];
  onApply: (fields: AppliedFields) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const { data, errors } = await client.queries.triageAssist({
        narrative,
        riskContext: riskContext.length ? JSON.stringify(riskContext) : undefined,
      });
      if (errors?.length) throw new Error(errors[0].message);
      const category = CATEGORIES.find((c) => c.key === data?.suggestedCategory)?.key ?? null;
      const categoryDef = CATEGORIES.find((c) => c.key === category);
      const subcategory = categoryDef?.subcategories.find((s) => s === data?.suggestedSubcategory) ?? null;
      const zone = ZONES.find((z) => z.key === data?.suggestedZone)?.key ?? null;
      const level = (data?.suggestedLevel as EscalationLevelKey) ?? null;
      const priority = data?.suggestedPriority === 'Major' ? 'Major' : data?.suggestedPriority === 'Standard' ? 'Standard' : null;
      const radioChannel =
        typeof data?.suggestedRadioChannel === 'number' && data.suggestedRadioChannel >= 1 && data.suggestedRadioChannel <= 5
          ? data.suggestedRadioChannel
          : null;
      const validRefs = new Set(riskContext.map((r) => r.ref));
      const riskRefs = (data?.suggestedRiskRefs ?? []).filter((r): r is string => !!r && validRefs.has(r));
      setSuggestion({
        category,
        subcategory,
        zone,
        level: escalationDef(level ?? '') ? level : null,
        priority,
        radioChannel,
        assignedAgency: data?.suggestedAssignedAgency ?? null,
        riskRefs,
        narrativeSummary: data?.narrativeSummary ?? null,
        rationale: data?.rationale ?? null,
      });
    } catch {
      setError('AI suggestion unavailable right now — fill in the form manually.');
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!suggestion) return;
    onApply({
      category: suggestion.category ?? undefined,
      subcategory: suggestion.subcategory ?? undefined,
      zone: suggestion.zone ?? undefined,
      priority: suggestion.priority ?? undefined,
      radioChannel: suggestion.radioChannel ?? undefined,
      assignedAgency: suggestion.assignedAgency ?? undefined,
      riskRefs: suggestion.riskRefs.length ? suggestion.riskRefs : undefined,
      narrative: suggestion.narrativeSummary ?? undefined,
    });
    setSuggestion(null);
  };

  const hasAnySuggestion =
    suggestion &&
    (suggestion.category || suggestion.zone || suggestion.level || suggestion.priority || suggestion.radioChannel || suggestion.riskRefs.length || suggestion.narrativeSummary);

  return (
    <div>
      <button type="button" className="secondary" onClick={ask} disabled={loading || narrative.trim().length < 10}>
        <Sparkles size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
        {loading ? 'Drafting…' : 'Fill form with AI'}
      </button>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
        Type a rough description above, then let AI draft category, zone, priority, radio channel, linked risks and a
        clean narrative — you review and confirm every field before it's applied.
      </p>

      {error && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{error}</p>
      )}

      {hasAnySuggestion && (
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
            <Sparkles size={14} /> AI draft
          </div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {suggestion?.category && (
              <li>
                Category: <strong>{categoryLabel(suggestion.category)}</strong>
                {suggestion.subcategory ? ` — ${suggestion.subcategory}` : ''}
              </li>
            )}
            {suggestion?.zone && (
              <li>
                Zone: <strong>{zoneLabel(suggestion.zone)}</strong>
              </li>
            )}
            {suggestion?.priority && (
              <li>
                Priority: <strong>{suggestion.priority}</strong>
              </li>
            )}
            {suggestion?.radioChannel && (
              <li>
                Radio channel: <strong>Ch{suggestion.radioChannel}</strong>
              </li>
            )}
            {suggestion?.assignedAgency && (
              <li>
                Agency: <strong>{suggestion.assignedAgency}</strong>
              </li>
            )}
            {suggestion && suggestion.riskRefs.length > 0 && (
              <li>
                Linked risks: <strong>{suggestion.riskRefs.join(', ')}</strong>
              </li>
            )}
            {suggestion?.level && (
              <li>
                Suggested level: <strong>{escalationDef(suggestion.level)?.name}</strong> (Controller/Admin declares after review)
              </li>
            )}
          </ul>
          {suggestion?.narrativeSummary && (
            <p style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
              "{suggestion.narrativeSummary}"
            </p>
          )}
          {suggestion?.rationale && (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 4 }}>{suggestion.rationale}</p>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={apply}>
              <Check size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Apply to form
            </button>
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
