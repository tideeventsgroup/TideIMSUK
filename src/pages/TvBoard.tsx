import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatTile } from '../components/StatTile';

const LEVEL_ORDER: Record<string, number> = { Level4: 0, Level3: 1, Level2: 2, Level1: 3 };
const SCROLL_STEP_PX = 1;
const SCROLL_INTERVAL_MS = 40;

/**
 * Read-only wall/TV display for a shared control-room monitor — no header,
 * no nav, no interactive controls beyond exit. Auto-scrolls so nobody has
 * to touch the screen. Same access as Live Board (event-control/fmic/
 * view-only); App.tsx hides its normal header chrome on this route.
 */
export function TvBoard() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const { incidents } = useIncidents(activeEvent?.id ?? null);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const timer = setInterval(() => {
      if (!el) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        el.scrollTop = 0;
      } else {
        el.scrollTop += SCROLL_STEP_PX;
      }
    }, SCROLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [incidents.length]);

  if (user && !['event-control', 'fmic', 'view-only'].includes(user.role)) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Not authorised.</p>;
  }

  const active = incidents.filter((i) => i.status !== 'Resolved');
  const sorted = [...active].sort((a, b) => {
    const levelDiff = (LEVEL_ORDER[a.escalationLevel] ?? 9) - (LEVEL_ORDER[b.escalationLevel] ?? 9);
    if (levelDiff !== 0) return levelDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const openCount = incidents.filter((i) => i.status === 'Open').length;
  const inProgressCount = incidents.filter((i) => i.status === 'InProgress').length;
  const criticalCount = incidents.filter((i) => (i.escalationLevel === 'Level3' || i.escalationLevel === 'Level4') && i.status !== 'Resolved').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-5) var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h1 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>{activeEvent?.name ?? 'Tide IMS'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div className="mono" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-text-secondary)' }}>
            {now.toLocaleTimeString('en-GB')}
          </div>
          <Link to="/" className="icon-button" aria-label="Exit TV mode" title="Exit TV mode">
            <X size={20} />
          </Link>
        </div>
      </div>

      <div className="stat-row" style={{ padding: 'var(--space-5) var(--space-6)', fontSize: 'var(--text-lg)' }}>
        <StatTile label="Open" value={openCount} />
        <StatTile label="In progress" value={inProgressCount} />
        <StatTile label="Active L3/L4" value={criticalCount} accent={criticalCount > 0 ? 'var(--sev-3)' : undefined} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'hidden', padding: '0 var(--space-6) var(--space-6)' }}>
        {sorted.length === 0 && (
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 'var(--space-8)' }}>
            No active incidents.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {sorted.map((incident) => (
            <div
              key={incident.id}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                background: 'var(--color-surface-raised)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <SeverityBadge level={incident.escalationLevel} />
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' }}>
                  {categoryLabel(incident.category)} · {zoneLabel(incident.zone)}
                </span>
                <span className="mono" style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-tertiary)' }}>
                  {new Date(incident.timestamp).toLocaleTimeString('en-GB')}
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-lg)', margin: 'var(--space-2) 0 0' }}>{incident.narrative}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
