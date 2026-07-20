import { useEffect, useRef, useState } from 'react';
import { Sparkles, Check, RefreshCw, X } from 'lucide-react';
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

const DEBOUNCE_MS = 800;
const MIN_LENGTH = 15;

/**
 * Triage-assist (Build Plan Section 11): fires automatically ~800ms after
 * the Loggist pauses typing, so the report exists and gets structured
 * without a "please wait" step in between. Nothing here ever blocks
 * submission — suggestions are tap-to-confirm chips the Loggist applies
 * individually, not a form the AI fills and locks. Never touches
 * escalation level (only Controller/Admin declare that, from the incident
 * page after creation) and never rewrites the narrative without an
 * explicit tap.
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
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const lastAskedFor = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ask = async (text: string) => {
    lastAskedFor.current = text;
    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await client.queries.triageAssist({
        narrative: text,
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
      setConfirmed(new Set());
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
      setError('AI suggestion unavailable — fill in fields manually below.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fire ~800ms after the Loggist pauses typing. Never blocks submit —
  // this is purely additive, arriving as a fast-follow to a report that
  // already exists the moment they started typing.
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = narrative.trim();
    if (trimmed.length < MIN_LENGTH || trimmed === lastAskedFor.current) return;
    debounceTimer.current = setTimeout(() => ask(trimmed), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrative]);

  const confirm = (key: string, fields: AppliedFields) => {
    onApply(fields);
    setConfirmed((prev) => new Set(prev).add(key));
  };

  const useNarrativeSummary = () => {
    if (!suggestion?.narrativeSummary) return;
    onApply({ narrative: suggestion.narrativeSummary });
    setConfirmed((prev) => new Set(prev).add('narrative'));
  };

  const chip = (key: string, label: string, fields: AppliedFields) => {
    const done = confirmed.has(key);
    return (
      <button
        key={key}
        type="button"
        onClick={() => !done && confirm(key, fields)}
        disabled={done}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 36,
          padding: '0 var(--space-3)',
          borderRadius: 'var(--radius-pill)',
          border: `1px solid ${done ? 'var(--sev-1)' : 'var(--color-brand)'}`,
          background: done ? 'var(--sev-1)' : 'transparent',
          color: done ? 'white' : 'var(--color-brand)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: done ? 'default' : 'pointer',
        }}
      >
        {done ? <Check size={14} /> : <Sparkles size={14} />}
        {label}
      </button>
    );
  };

  const hasSuggestion =
    suggestion &&
    (suggestion.category || suggestion.zone || suggestion.priority || suggestion.radioChannel || suggestion.assignedAgency || suggestion.riskRefs.length || suggestion.narrativeSummary);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 20 }}>
        {loading && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} className="spin" /> AI is reading that…
          </span>
        )}
        {!loading && suggestion && (
          <button
            type="button"
            onClick={() => ask(narrative.trim())}
            disabled={narrative.trim().length < MIN_LENGTH}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} /> Refresh AI suggestions
          </button>
        )}
        {error && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{error}</span>}
      </div>

      {hasSuggestion && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {suggestion!.category &&
              chip(
                'category',
                `${categoryLabel(suggestion!.category)}${suggestion!.subcategory ? ` — ${suggestion!.subcategory}` : ''}`,
                { category: suggestion!.category, subcategory: suggestion!.subcategory ?? undefined },
              )}
            {suggestion!.zone && chip('zone', zoneLabel(suggestion!.zone), { zone: suggestion!.zone })}
            {suggestion!.priority && chip('priority', `Priority: ${suggestion!.priority}`, { priority: suggestion!.priority })}
            {suggestion!.radioChannel && chip('radio', `Ch${suggestion!.radioChannel}`, { radioChannel: suggestion!.radioChannel })}
            {suggestion!.assignedAgency && chip('agency', suggestion!.assignedAgency, { assignedAgency: suggestion!.assignedAgency })}
            {suggestion!.riskRefs.length > 0 &&
              chip('risks', `Risks: ${suggestion!.riskRefs.join(', ')}`, { riskRefs: suggestion!.riskRefs })}
          </div>

          {suggestion!.narrativeSummary && (
            <div style={{ marginTop: 'var(--space-2)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', flex: 1 }}>
                "{suggestion!.narrativeSummary}"
              </p>
              {confirmed.has('narrative') ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--sev-1)', fontSize: 'var(--text-xs)', fontWeight: 600, flexShrink: 0 }}>
                  <Check size={13} /> Applied
                </span>
              ) : (
                <button type="button" className="secondary" onClick={useNarrativeSummary} style={{ minHeight: 32, fontSize: 'var(--text-xs)', padding: '0 var(--space-2)', flexShrink: 0 }}>
                  Use this wording
                </button>
              )}
            </div>
          )}

          {suggestion!.level && (
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Reads like <strong>{escalationDef(suggestion!.level)?.name}</strong> — Controller/Admin declares the actual level after review.
            </p>
          )}
          {suggestion!.rationale && (
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{suggestion!.rationale}</p>
          )}

          <button
            type="button"
            onClick={() => setSuggestion(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 4,
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            <X size={12} /> Hide suggestions
          </button>
        </div>
      )}
    </div>
  );
}
