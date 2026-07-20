import { Siren } from 'lucide-react';
import type { Incident } from '../types/incident';

/** On-screen banner across all devices for Level 4 / Critical incidents (OSSP Section 5.2). */
export function EscalationBanner({ incidents }: { incidents: Incident[] }) {
  const critical = incidents.filter((i) => i.escalationLevel === 'Level4' && i.status !== 'Resolved');
  if (critical.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        background: 'var(--sev-4-solid)',
        color: '#ffffff',
        padding: 'var(--space-3) var(--space-4)',
        fontWeight: 700,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
      }}
    >
      <Siren size={18} className="banner-pulse" aria-hidden="true" />
      CRITICAL — {critical.length} Level 4 incident{critical.length > 1 ? 's' : ''} active. Emergency
      services command in effect.
      <style>{`
        @keyframes banner-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .banner-pulse { animation: banner-pulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .banner-pulse { animation: none; } }
      `}</style>
    </div>
  );
}
