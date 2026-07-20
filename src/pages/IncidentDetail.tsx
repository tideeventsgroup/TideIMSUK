import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, MapPin, Radio as RadioIcon } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { ESCALATION_LEVELS, canDeclareLevel, type EscalationLevelKey } from '../constants/escalation';
import { SeverityBadge } from '../components/SeverityBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Incident, IncidentStatus } from '../types/incident';

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<EscalationLevelKey | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const { data } = await client.models.Incident.get({ id: id! });
      if (!cancelled) setIncident(data as unknown as Incident);
    }
    load();

    const sub = client.models.Incident.onUpdate({ filter: { id: { eq: id } } }).subscribe({
      next: (updated) => setIncident(updated as unknown as Incident),
    });
    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [id]);

  if (!incident || !user) return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Loading…</p>;

  const isCommand = user.role === 'Controller' || user.role === 'Admin';
  // Client-side enforcement of the Level 4 lock (see amplify/data/resource.ts note) —
  // pending a server-side custom resolver for full enforcement.
  const editLocked = incident.locked && !isCommand;

  const appendUpdate = async () => {
    if (!updateText.trim()) return;
    setBusy(true);
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        userId: user.userId,
        userName: user.name,
        text: updateText.trim(),
      };
      await client.models.Incident.update({
        id: incident.id,
        updates: [...(incident.updates ?? []), entry],
      });
      setUpdateText('');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: IncidentStatus) => {
    setBusy(true);
    try {
      await client.models.Incident.update({
        id: incident.id,
        status,
        resolvedAt: status === 'Resolved' ? new Date().toISOString() : incident.resolvedAt,
      });
    } finally {
      setBusy(false);
    }
  };

  const declareLevel = async (newLevel: EscalationLevelKey) => {
    if (!canDeclareLevel(user.role, newLevel)) return;
    setBusy(true);
    try {
      await client.models.Incident.update({
        id: incident.id,
        escalationLevel: newLevel,
        locked: newLevel === 'Level4',
      });
    } finally {
      setBusy(false);
      setPendingLevel(null);
    }
  };

  const requestDeclare = (level: EscalationLevelKey) => {
    // Levels 3/4 are high-consequence (OSSP command handover) — confirm first.
    if (level === 'Level3' || level === 'Level4') {
      setPendingLevel(level);
    } else {
      void declareLevel(level);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <SeverityBadge level={incident.escalationLevel} />
      </div>
      <h1 style={{ fontSize: 'var(--text-lg)' }}>
        {categoryLabel(incident.category)}
        {incident.subcategory ? ` — ${incident.subcategory}` : ''}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        <MapPin size={14} /> {zoneLabel(incident.zone)} <span aria-hidden="true">·</span> {incident.status}{' '}
        <span aria-hidden="true">·</span> {incident.priority}
        {incident.radioChannel && (
          <>
            <span aria-hidden="true">·</span>
            <RadioIcon size={14} /> Ch{incident.radioChannel}
          </>
        )}
      </p>
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
        Logged by {incident.loggedByName} ({incident.loggedByRole}) at{' '}
        <span className="mono">{new Date(incident.timestamp).toLocaleString('en-GB')}</span>
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{incident.narrative}</p>

      {incident.locked && (
        <p style={{ color: 'var(--sev-4)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <Lock size={16} /> Locked to Controller/Admin — live command in effect.
        </p>
      )}

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Status</h2>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {(['Open', 'InProgress', 'Resolved'] as IncidentStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            className={incident.status === s ? '' : 'secondary'}
            disabled={busy || editLocked || incident.status === s}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {isCommand && (
        <>
          <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Declare escalation level</h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {ESCALATION_LEVELS.map((l) => (
              <button
                key={l.key}
                type="button"
                className={l.number >= 3 ? 'danger' : 'secondary'}
                disabled={busy || incident.escalationLevel === l.key}
                onClick={() => requestDeclare(l.key)}
              >
                L{l.number} {l.name}
              </button>
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Updates</h2>
      <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {(incident.updates ?? []).map((u, idx) => (
          <li
            key={idx}
            style={{
              borderLeft: '2px solid var(--color-border-strong)',
              paddingLeft: 'var(--space-3)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span className="mono" style={{ color: 'var(--color-text-tertiary)' }}>
              {new Date(u.timestamp).toLocaleString('en-GB')}
            </span>{' '}
            — <strong>{u.userName}</strong>: {u.text}
          </li>
        ))}
        {(incident.updates ?? []).length === 0 && (
          <li style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No updates yet.</li>
        )}
      </ul>

      {!editLocked && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
          <input
            style={{ flex: 1 }}
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="Add a timestamped update…"
            aria-label="Add a timestamped update"
          />
          <button type="button" disabled={busy || !updateText.trim()} onClick={appendUpdate}>
            Add
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pendingLevel !== null}
        title={`Declare ${pendingLevel ? `Level ${pendingLevel.replace('Level', '')}` : ''}?`}
        description={
          pendingLevel === 'Level4'
            ? 'This declares a Critical incident: 999/emergency services assume scene command, a push alert and banner go to every device, and the incident locks to Controller/Admin only. Confirm this is an authorised command decision.'
            : 'This declares a Major incident: FMIC commands ground response, agencies are notified, and the incident is pinned with a push alert to every device.'
        }
        confirmLabel={`Declare ${pendingLevel ? `Level ${pendingLevel.replace('Level', '')}` : ''}`}
        danger
        onConfirm={() => pendingLevel && declareLevel(pendingLevel)}
        onCancel={() => setPendingLevel(null)}
      />
    </div>
  );
}
