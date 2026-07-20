import { Link } from 'react-router-dom';
import type { Incident } from '../types/incident';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { escalationDef } from '../constants/escalation';
import { THEME } from '../constants/theme';

export function IncidentCard({ incident }: { incident: Incident }) {
  const level = escalationDef(incident.escalationLevel);
  const color = THEME.levelColors[incident.escalationLevel] ?? THEME.levelColors.Level1;

  return (
    <Link
      to={`/incidents/${incident.id}`}
      style={{
        display: 'block',
        border: `1px solid ${color}`,
        borderLeft: `6px solid ${color}`,
        borderRadius: 4,
        padding: '0.75rem 1rem',
        marginBottom: '0.5rem',
        textDecoration: 'none',
        color: THEME.colorPrimary,
        background: THEME.colorBackground,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
        <span>{new Date(incident.timestamp).toLocaleString('en-GB')}</span>
        <span style={{ fontWeight: 600, color }}>
          L{level?.number} {level?.name}
        </span>
      </div>
      <div style={{ fontWeight: 600 }}>
        {categoryLabel(incident.category)}
        {incident.subcategory ? ` — ${incident.subcategory}` : ''}
      </div>
      <div style={{ fontSize: '0.9rem' }}>
        {zoneLabel(incident.zone)} · {incident.status} · {incident.priority}
      </div>
      <div style={{ fontSize: '0.9rem', color: '#444', marginTop: '0.25rem' }}>{incident.narrative}</div>
      {incident.locked && (
        <div style={{ fontSize: '0.8rem', color: '#7c2d12', marginTop: '0.25rem' }}>
          Locked — Controller/Admin only
        </div>
      )}
    </Link>
  );
}
