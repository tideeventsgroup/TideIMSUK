import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MapPinCheck, ClipboardList, ArrowRightLeft } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useIncidents } from '../hooks/useIncidents';
import { ZONES, zoneLabel, type ZoneKey } from '../constants/zones';
import { staffStatusLabel } from '../constants/staffStatus';
import { categoryLabel } from '../constants/taxonomy';
import { SeverityBadge } from '../components/SeverityBadge';
import { pushNotify } from '../utils/pushNotify';
import type { UserProfileRecord } from '../types/userProfile';
import type { ZoneClearance, ShiftHandoverNote } from '../types/groundOps';

const STATUS_COLOR: Record<string, string> = {
  OnPost: 'var(--sev-1)',
  Break: 'var(--color-text-tertiary)',
  OffDuty: 'var(--color-border-strong)',
};

function timeSince(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function useRoster(eventId: string | null) {
  const [roster, setRoster] = useState<UserProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await client.models.UserProfile.list({ filter: { role: { eq: 'staff' } } });
      if (!cancelled) {
        setRoster((data as unknown as UserProfileRecord[]).sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      }
    }
    load();
    const sub = client.models.UserProfile.onUpdate({}).subscribe({
      next: (profile) => {
        setRoster((prev) => prev.map((p) => (p.id === profile.id ? (profile as unknown as UserProfileRecord) : p)));
      },
    });
    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [eventId]);

  return { roster, loading };
}

function RedeployControl({ member, eventId, onDone }: { member: UserProfileRecord; eventId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="secondary" style={{ minHeight: 32, padding: '0 var(--space-2)', fontSize: 'var(--text-xs)' }} onClick={() => setOpen(true)}>
        <ArrowRightLeft size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
        Redeploy
      </button>
    );
  }

  const redeploy = async (toZone: ZoneKey) => {
    if (!user) return;
    setBusy(true);
    try {
      const fromZone = member.assignedZone ?? undefined;
      await client.models.UserProfile.update({ id: member.id, assignedZone: toZone });
      await client.models.ZoneReassignment.create({
        eventId,
        userId: member.cognitoSub,
        userName: member.name,
        fromZone,
        toZone,
        reassignedByUserId: user.userId,
        reassignedByName: user.name,
        timestamp: new Date().toISOString(),
      });
      void pushNotify(
        'Reassigned',
        `${user.name} moved you to ${zoneLabel(toZone)}.`,
        '/',
        false,
        false,
        member.cognitoSub,
      );
      setOpen(false);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      autoFocus
      disabled={busy}
      value=""
      onChange={(e) => e.target.value && redeploy(e.target.value as ZoneKey)}
      onBlur={() => setOpen(false)}
      style={{ minHeight: 32, fontSize: 'var(--text-xs)', padding: '0 var(--space-2)' }}
      aria-label={`Redeploy ${member.name}`}
    >
      <option value="" disabled>
        Move to…
      </option>
      {ZONES.map((z) => (
        <option key={z.key} value={z.key}>
          {z.label}
        </option>
      ))}
    </select>
  );
}

export function FMICGround() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const { roster, loading: rosterLoading } = useRoster(activeEvent?.id ?? null);
  const { incidents } = useIncidents(activeEvent?.id ?? null);
  const [clearances, setClearances] = useState<ZoneClearance[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandoverNote[]>([]);
  const [openItems, setOpenItems] = useState('');
  const [watchItems, setWatchItems] = useState('');
  const [whereaboutsNote, setWhereaboutsNote] = useState('');
  const [handoverBusy, setHandoverBusy] = useState(false);
  const [clearanceBusy, setClearanceBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEvent) return;
    client.models.ZoneClearance.list({ filter: { eventId: { eq: activeEvent.id } } }).then(({ data }) => {
      setClearances(data as unknown as ZoneClearance[]);
    });
    client.models.ShiftHandoverNote.list({ filter: { eventId: { eq: activeEvent.id } } }).then(({ data }) => {
      const sorted = (data as unknown as ShiftHandoverNote[]).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      setHandovers(sorted);
    });
  }, [activeEvent?.id]);

  if (!user || (user.role !== 'event-control' && user.role !== 'fmic')) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Only Event Control/FMIC can access ground ops.</p>;
  }

  if (!activeEvent) {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        No event configured yet — Event Control needs to set one up.
      </p>
    );
  }

  const attention = incidents
    .filter((i) => i.status !== 'Resolved' && i.escalationLevel !== 'Level1')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latestClearanceByZone = new Map<string, ZoneClearance>();
  for (const c of clearances) {
    const existing = latestClearanceByZone.get(c.zone);
    if (!existing || new Date(c.timestamp) > new Date(existing.timestamp)) latestClearanceByZone.set(c.zone, c);
  }

  const confirmZone = async (zone: ZoneKey, cleared: boolean) => {
    if (!user) return;
    setClearanceBusy(zone);
    try {
      const record = await client.models.ZoneClearance.create({
        eventId: activeEvent.id,
        zone,
        cleared,
        confirmedByUserId: user.userId,
        confirmedByName: user.name,
        timestamp: new Date().toISOString(),
      });
      if (record.data) setClearances((prev) => [...prev, record.data as unknown as ZoneClearance]);
      void pushNotify(
        cleared ? `Zone clear: ${zoneLabel(zone)}` : `Zone reset: ${zoneLabel(zone)}`,
        `${user.name} ${cleared ? 'confirmed swept' : 'reset for a new roll call'} — ${zoneLabel(zone)}.`,
      );
    } finally {
      setClearanceBusy(null);
    }
  };

  const logHandover = async () => {
    if (!user || (!openItems.trim() && !watchItems.trim() && !whereaboutsNote.trim())) return;
    setHandoverBusy(true);
    try {
      const record = await client.models.ShiftHandoverNote.create({
        eventId: activeEvent.id,
        openItems: openItems.trim() || undefined,
        watchItems: watchItems.trim() || undefined,
        whereaboutsNote: whereaboutsNote.trim() || undefined,
        authoredByUserId: user.userId,
        authoredByName: user.name,
        timestamp: new Date().toISOString(),
      });
      if (record.data) setHandovers((prev) => [record.data as unknown as ShiftHandoverNote, ...prev]);
      void pushNotify('Shift handover logged', `${user.name} logged a handover note.`);
      setOpenItems('');
      setWatchItems('');
      setWhereaboutsNote('');
    } finally {
      setHandoverBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--text-lg)' }}>Ground ops</h1>

      <section>
        <h2 style={{ fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)' }}>
          <Users size={16} /> Staff roster
        </h2>
        {rosterLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
        {!rosterLoading && roster.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>No staff have registered a zone or status yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {roster.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-2) var(--space-3)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{member.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[member.status ?? ''] ?? 'var(--color-border-strong)' }}
                  />
                  {staffStatusLabel(member.status)}
                  {member.statusUpdatedAt && ` since ${timeSince(member.statusUpdatedAt)}`}
                  <span aria-hidden="true">·</span>
                  {member.assignedZone ? zoneLabel(member.assignedZone) : 'No zone set'}
                </div>
              </div>
              <RedeployControl member={member} eventId={activeEvent.id} onDone={() => {}} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)' }}>
          <MapPinCheck size={16} /> Zone clear roll call
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {ZONES.filter((z) => z.key !== 'WholeSite').map((zone) => {
            const latest = latestClearanceByZone.get(zone.key);
            const cleared = latest?.cleared ?? false;
            return (
              <div
                key={zone.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  border: `1px solid ${cleared ? 'var(--sev-1)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-2) var(--space-3)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{zone.label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: cleared ? 'var(--sev-1)' : 'var(--color-text-tertiary)' }}>
                    {cleared ? `Confirmed swept — ${latest?.confirmedByName}, ${timeSince(latest?.timestamp)}` : 'Pending'}
                  </div>
                </div>
                <button
                  type="button"
                  className={cleared ? 'secondary' : ''}
                  disabled={clearanceBusy === zone.key}
                  onClick={() => confirmZone(zone.key, !cleared)}
                  style={{ minHeight: 32, padding: '0 var(--space-2)', fontSize: 'var(--text-xs)' }}
                >
                  {cleared ? 'Reset' : 'Confirm swept'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>Needs attention</h2>
        {attention.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>Nothing open beyond Level 1.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {attention.map((i) => (
            <Link
              key={i.id}
              to={`/incidents/${i.id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-2) var(--space-3)',
                textDecoration: 'none',
                color: 'var(--color-text-primary)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  {categoryLabel(i.category)} — {zoneLabel(i.zone)}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{i.status}</div>
              </div>
              <SeverityBadge level={i.escalationLevel} size="sm" />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-3)' }}>
          <ClipboardList size={16} /> Shift handover
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label>
            What's open
            <textarea rows={2} value={openItems} onChange={(e) => setOpenItems(e.target.value)} placeholder="Incidents/jobs still in progress" />
          </label>
          <label>
            What to watch
            <textarea rows={2} value={watchItems} onChange={(e) => setWatchItems(e.target.value)} placeholder="Anything building or worth flagging" />
          </label>
          <label>
            Who's where
            <textarea rows={2} value={whereaboutsNote} onChange={(e) => setWhereaboutsNote(e.target.value)} placeholder="Notable resourcing/zone notes" />
          </label>
          <button type="button" disabled={handoverBusy} onClick={logHandover} style={{ alignSelf: 'flex-start', minHeight: 40, padding: '0 var(--space-4)' }}>
            {handoverBusy ? 'Logging…' : 'Log handover'}
          </button>
        </div>

        {handovers.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {handovers.slice(0, 5).map((h) => (
              <div key={h.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                  {h.authoredByName} · <span className="mono">{new Date(h.timestamp).toLocaleString('en-GB')}</span>
                </div>
                {h.openItems && <div><strong>Open:</strong> {h.openItems}</div>}
                {h.watchItems && <div><strong>Watch:</strong> {h.watchItems}</div>}
                {h.whereaboutsNote && <div><strong>Where:</strong> {h.whereaboutsNote}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
