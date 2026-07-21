import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { client } from '../data/client';
import { categoryLabel } from '../constants/taxonomy';
import { ZONES, zoneLabel } from '../constants/zones';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatTile } from '../components/StatTile';
import { WindConditionsPanel } from '../components/WindConditionsPanel';
import type { ZoneClearance, ShiftRosterEntry } from '../types/groundOps';

const LEVEL_ORDER: Record<string, number> = { Level4: 0, Level3: 1, Level2: 2, Level1: 3 };
const SCROLL_STEP_PX = 1;
const SCROLL_INTERVAL_MS = 30;
const EDGE_PAUSE_MS = 2500;

function timeAgo(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

/**
 * Read-only wall/TV display for a shared control-room monitor — no header,
 * no nav, no interactive controls beyond exit. Forces dark styling via a
 * scoped data-theme override (not the global ThemeContext — leaving this
 * page shouldn't flip the operator's own device theme) since a wall
 * display benefits from a fixed high-contrast look regardless of whoever
 * last touched the shared screen's browser settings.
 */
export function TvBoard() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const { incidents } = useIncidents(activeEvent?.id ?? null);
  const [now, setNow] = useState(new Date());
  const [clearances, setClearances] = useState<ZoneClearance[]>([]);
  const [roster, setRoster] = useState<ShiftRosterEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pauseUntil = useRef(0);
  const direction = useRef<1 | -1>(1);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!activeEvent) return;
    client.models.ZoneClearance.list({ filter: { eventId: { eq: activeEvent.id } } }).then(({ data }) => {
      setClearances(data as unknown as ZoneClearance[]);
    });
    client.models.ShiftRosterEntry.list({ filter: { eventId: { eq: activeEvent.id } } }).then(({ data }) => {
      setRoster(data as unknown as ShiftRosterEntry[]);
    });
  }, [activeEvent?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;
      if (Date.now() < pauseUntil.current) return;

      const next = el.scrollTop + SCROLL_STEP_PX * direction.current;
      if (next >= maxScroll) {
        el.scrollTop = maxScroll;
        direction.current = -1;
        pauseUntil.current = Date.now() + EDGE_PAUSE_MS;
      } else if (next <= 0) {
        el.scrollTop = 0;
        direction.current = 1;
        pauseUntil.current = Date.now() + EDGE_PAUSE_MS;
      } else {
        el.scrollTop = next;
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

  const nowMs = now.getTime();
  const onShiftNow = roster.filter((r) => new Date(r.shiftStart).getTime() <= nowMs && nowMs <= new Date(r.shiftEnd).getTime());

  const latestClearanceByZone = new Map<string, ZoneClearance>();
  for (const c of clearances) {
    const existing = latestClearanceByZone.get(c.zone);
    if (!existing || new Date(c.timestamp) > new Date(existing.timestamp)) latestClearanceByZone.set(c.zone, c);
  }
  const relevantZones = ZONES.filter((z) => z.key !== 'WholeSite');

  return (
    <div data-theme="dark" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '28px 40px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src="/brand/tide-logo-white-text.png" alt="" height={32} style={{ display: 'block' }} />
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>{activeEvent?.name ?? 'Tide IMS'}</h1>
            {activeEvent && (
              <div style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {activeEvent.venue} · {activeEvent.startDate} – {activeEvent.endDate}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
              {now.toLocaleTimeString('en-GB')}
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <Link to="/" className="icon-button" aria-label="Exit TV mode" title="Exit TV mode">
            <X size={20} />
          </Link>
        </div>
      </div>

      <div className="stat-row" style={{ padding: '20px 40px', gap: 16 }}>
        <StatTile label="Open" value={openCount} />
        <StatTile label="In progress" value={inProgressCount} />
        <StatTile label="Active L3/L4" value={criticalCount} accent={criticalCount > 0 ? 'var(--sev-3)' : undefined} />
        <StatTile label="On shift now" value={onShiftNow.length} />
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 24, padding: '0 40px 32px', minHeight: 0 }}>
        <div ref={scrollRef} style={{ flex: 2, overflowY: 'hidden', minWidth: 0 }}>
          {sorted.length === 0 && (
            <p style={{ fontSize: 22, color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 60 }}>
              No active incidents.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sorted.map((incident) => (
              <div
                key={incident.id}
                className={incident.escalationLevel === 'Level4' ? 'tv-critical' : undefined}
                style={{
                  border: '2px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '20px 24px',
                  background: 'var(--color-surface-raised)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <SeverityBadge level={incident.escalationLevel} />
                  <span style={{ fontSize: 18, color: 'var(--color-text-secondary)' }}>
                    {categoryLabel(incident.category)} · {zoneLabel(incident.zone)}
                  </span>
                  <span className="mono" style={{ fontSize: 16, color: 'var(--color-text-tertiary)' }}>
                    {timeAgo(incident.timestamp, now)}
                  </span>
                </div>
                <p style={{ fontSize: 22, lineHeight: 1.4, margin: '10px 0 0' }}>{incident.narrative}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <WindConditionsPanel />

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', background: 'var(--color-surface-raised)' }}>
            <strong style={{ fontSize: 15 }}>Zone status</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {relevantZones.map((z) => {
                const cleared = latestClearanceByZone.get(z.key)?.cleared;
                return (
                  <div key={z.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15 }}>
                    <span>{z.label}</span>
                    {cleared ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-success, #22c55e)' }}>
                        <CheckCircle2 size={14} /> Clear
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-tertiary)' }}>
                        <Circle size={14} /> —
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', background: 'var(--color-surface-raised)', flex: 1 }}>
            <strong style={{ fontSize: 15 }}>On shift now ({onShiftNow.length})</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {onShiftNow.map((r) => (
                <div key={r.id} style={{ fontSize: 15 }}>
                  {r.personName} <span style={{ color: 'var(--color-text-tertiary)' }}>· {r.position}{r.zone ? ` · ${zoneLabel(r.zone)}` : ''}</span>
                </div>
              ))}
              {onShiftNow.length === 0 && <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', margin: 0 }}>No shifts scheduled right now.</p>}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 40px',
          borderTop: '1px solid var(--color-border)',
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-brand)', display: 'inline-block' }} className="tv-live-dot" />
        Live — updates automatically
      </div>
    </div>
  );
}
