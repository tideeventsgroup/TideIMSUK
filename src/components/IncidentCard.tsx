import { Link } from 'react-router-dom';
import { Clock, MapPin, Lock } from 'lucide-react';
import type { Incident } from '../types/incident';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { SeverityBadge } from './SeverityBadge';

export function IncidentCard({ incident }: { incident: Incident }) {
  const n = { Level1: 1, Level2: 2, Level3: 3, Level4: 4 }[incident.escalationLevel] ?? 1;

  return (
    <Link
      to={`/incidents/${incident.id}`}
      style={{
        display: 'block',
        border: '1px solid var(--color-border)',
        borderLeft: `4px solid var(--sev-${n})`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-2)',
        textDecoration: 'none',
        color: 'var(--color-text-primary)',
        background: 'var(--color-surface-raised)',
        boxShadow: 'var(--shadow-card)',
        transition: 'background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <span
          className="mono"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Clock size={12} />
          {new Date(incident.timestamp).toLocaleString('en-GB')}
        </span>
        <SeverityBadge level={incident.escalationLevel} size="sm" />
      </div>

      <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
        {categoryLabel(incident.category)}
        {incident.subcategory ? ` — ${incident.subcategory}` : ''}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
          marginTop: 2,
        }}
      >
        <MapPin size={13} />
        {zoneLabel(incident.zone)} <span aria-hidden="true">·</span> {incident.status}{' '}
        <span aria-hidden="true">·</span> {incident.priority}
      </div>

      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
          marginTop: 'var(--space-2)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {incident.narrative}
      </div>

      {incident.locked && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 'var(--text-xs)',
            color: 'var(--sev-4)',
            marginTop: 'var(--space-2)',
            fontWeight: 600,
          }}
        >
          <Lock size={12} /> Locked — Event Control only
        </div>
      )}

      {(incident.linkedRiskIds ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'var(--space-2)' }}>
          {(incident.linkedRiskIds ?? []).map((refId) => (
            <span
              key={refId}
              className="mono"
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {refId}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
