import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { ESCALATION_LEVELS, canDeclareLevel, escalationDef, type EscalationLevelKey } from '../constants/escalation';
import { THEME } from '../constants/theme';
import type { Incident, IncidentStatus } from '../types/incident';

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [busy, setBusy] = useState(false);

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

  if (!incident || !user) return <p style={{ padding: '1rem' }}>Loading…</p>;

  const isCommand = user.role === 'Controller' || user.role === 'Admin';
  // Client-side enforcement of the Level 4 lock (see resource.ts note) —
  // pending a server-side custom resolver for full enforcement.
  const editLocked = incident.locked && !isCommand;
  const level = escalationDef(incident.escalationLevel);

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
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '1rem' }}>
      <div style={{ fontWeight: 700, color: THEME.levelColors[incident.escalationLevel] }}>
        L{level?.number} {level?.name}
      </div>
      <h1 style={{ fontSize: '1.25rem' }}>
        {categoryLabel(incident.category)}
        {incident.subcategory ? ` — ${incident.subcategory}` : ''}
      </h1>
      <p>
        {zoneLabel(incident.zone)} · {incident.status} · {incident.priority} · logged by{' '}
        {incident.loggedByName} ({incident.loggedByRole}) at {new Date(incident.timestamp).toLocaleString('en-GB')}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{incident.narrative}</p>

      {incident.locked && (
        <p style={{ color: THEME.levelColors.Level4, fontWeight: 600 }}>
          Locked to Controller/Admin — live command in effect.
        </p>
      )}

      <h2 style={{ fontSize: '1rem' }}>Status</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['Open', 'InProgress', 'Resolved'] as IncidentStatus[]).map((s) => (
          <button key={s} disabled={busy || editLocked || incident.status === s} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      {isCommand && (
        <>
          <h2 style={{ fontSize: '1rem' }}>Declare escalation level</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {ESCALATION_LEVELS.map((l) => (
              <button key={l.key} disabled={busy || incident.escalationLevel === l.key} onClick={() => declareLevel(l.key)}>
                L{l.number} {l.name}
              </button>
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: '1rem' }}>Updates</h2>
      <ul style={{ paddingLeft: '1.2rem' }}>
        {(incident.updates ?? []).map((u, idx) => (
          <li key={idx}>
            <strong>{new Date(u.timestamp).toLocaleString('en-GB')}</strong> — {u.userName}: {u.text}
          </li>
        ))}
        {(incident.updates ?? []).length === 0 && <li>No updates yet.</li>}
      </ul>

      {!editLocked && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            style={{ flex: 1 }}
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="Add a timestamped update…"
          />
          <button disabled={busy || !updateText.trim()} onClick={appendUpdate}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}
