import type { Incident } from '../types/incident';
import { THEME } from '../constants/theme';

/** On-screen banner across all devices for Level 4 / Critical incidents (OSSP Section 5.2). */
export function EscalationBanner({ incidents }: { incidents: Incident[] }) {
  const critical = incidents.filter((i) => i.escalationLevel === 'Level4' && i.status !== 'Resolved');
  if (critical.length === 0) return null;

  return (
    <div
      style={{
        background: THEME.levelColors.Level4,
        color: '#fff',
        padding: '0.75rem 1rem',
        fontWeight: 700,
        textAlign: 'center',
      }}
    >
      CRITICAL — {critical.length} Level 4 incident{critical.length > 1 ? 's' : ''} active. Emergency
      services command in effect.
    </div>
  );
}
