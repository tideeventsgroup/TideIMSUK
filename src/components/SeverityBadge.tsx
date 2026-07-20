import { Circle, AlertCircle, AlertTriangle, Siren } from 'lucide-react';
import { escalationDef, type EscalationLevelKey } from '../constants/escalation';

const ICONS: Record<EscalationLevelKey, typeof Circle> = {
  Level1: Circle,
  Level2: AlertCircle,
  Level3: AlertTriangle,
  Level4: Siren,
};

const CSS_VAR: Record<EscalationLevelKey, number> = { Level1: 1, Level2: 2, Level3: 3, Level4: 4 };

/**
 * The dominant hierarchy signal in the UI. Never color-only: always pairs
 * an icon (rank-shaped, not just tint) with the "L{n} Name" text so it
 * reads correctly for colorblind users and in bright daylight glare.
 */
export function SeverityBadge({ level, size = 'md' }: { level: EscalationLevelKey; size?: 'sm' | 'md' }) {
  const def = escalationDef(level);
  const Icon = ICONS[level];
  const n = CSS_VAR[level];
  if (!def) return null;

  return (
    <span
      className={`severity-badge severity-badge--${size}`}
      style={{
        color: `var(--sev-${n})`,
        background: `var(--sev-${n}-bg)`,
        borderColor: `var(--sev-${n})`,
      }}
    >
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.5} aria-hidden="true" />
      L{def.number} {def.name}
    </span>
  );
}
