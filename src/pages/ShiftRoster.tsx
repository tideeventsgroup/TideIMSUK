import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { ZONES, zoneLabel, type ZoneKey } from '../constants/zones';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ShiftRosterEntry } from '../types/groundOps';

const emptyForm = {
  id: null as string | null,
  personName: '',
  position: '',
  zone: '' as ZoneKey | '',
  shiftStart: '',
  shiftEnd: '',
  notes: '',
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShiftRoster() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const [entries, setEntries] = useState<ShiftRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShiftRosterEntry | null>(null);

  const load = async () => {
    if (!activeEvent) return;
    setLoading(true);
    try {
      const { data } = await client.models.ShiftRosterEntry.list({ filter: { eventId: { eq: activeEvent.id } } });
      setEntries((data as unknown as ShiftRosterEntry[]).sort((a, b) => (a.shiftStart < b.shiftStart ? -1 : 1)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeEvent?.id]);

  if (user && user.role !== 'event-control' && user.role !== 'fmic') {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        Only Event Control and FMIC can manage the shift roster.
      </p>
    );
  }

  if (!activeEvent) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>No event configured yet.</p>;
  }

  const startEdit = (entry: ShiftRosterEntry) => {
    setForm({
      id: entry.id,
      personName: entry.personName,
      position: entry.position,
      zone: (entry.zone as ZoneKey | null) ?? '',
      shiftStart: toLocalInput(entry.shiftStart),
      shiftEnd: toLocalInput(entry.shiftEnd),
      notes: entry.notes ?? '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        eventId: activeEvent.id,
        personName: form.personName.trim(),
        position: form.position.trim(),
        zone: form.zone || undefined,
        shiftStart: new Date(form.shiftStart).toISOString(),
        shiftEnd: new Date(form.shiftEnd).toISOString(),
        notes: form.notes.trim() || undefined,
      };
      if (form.id) {
        await client.models.ShiftRosterEntry.update({ id: form.id, ...payload });
      } else {
        await client.models.ShiftRosterEntry.create(payload);
      }
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save roster entry');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await client.models.ShiftRosterEntry.delete({ id: pendingDelete.id });
      await load();
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  const now = Date.now();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-lg)' }}>Shift roster</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        The planned staffing schedule — who's supposed to be where and when. Distinct from the live on-post/break/
        off-duty status staff self-report on their own devices.
      </p>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Shifts</h2>
      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {entries.map((entry) => {
          const onShiftNow = new Date(entry.shiftStart).getTime() <= now && now <= new Date(entry.shiftEnd).getTime();
          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-2)',
                border: onShiftNow ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                background: 'var(--color-surface-raised)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong>{entry.personName}</strong> <span style={{ color: 'var(--color-text-secondary)' }}>· {entry.position}</span>
                {onShiftNow && (
                  <span style={{ marginLeft: 8, fontSize: 'var(--text-xs)', color: 'var(--color-brand)', fontWeight: 600 }}>
                    ON SHIFT NOW
                  </span>
                )}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  {entry.zone ? `${zoneLabel(entry.zone)} · ` : ''}
                  <span className="mono">
                    {new Date(entry.shiftStart).toLocaleString('en-GB')} – {new Date(entry.shiftEnd).toLocaleTimeString('en-GB')}
                  </span>
                </div>
                {entry.notes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{entry.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" className="icon-button" onClick={() => startEdit(entry)} aria-label={`Edit ${entry.personName}`}>
                  <Pencil size={15} />
                </button>
                <button type="button" className="icon-button" onClick={() => setPendingDelete(entry)} aria-label={`Delete ${entry.personName}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
        {!loading && entries.length === 0 && <p style={{ color: 'var(--color-text-tertiary)' }}>No shifts scheduled yet.</p>}
      </div>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>{form.id ? 'Edit shift' : 'Add shift'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="field-row">
          <label>
            Name
            <input required value={form.personName} onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))} placeholder="Full name" />
          </label>
          <label>
            Position
            <input required value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder="e.g. Steward, Medic, FMIC" />
          </label>
        </div>

        <label>
          Zone
          <select value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value as ZoneKey }))}>
            <option value="">— none —</option>
            {ZONES.map((z) => (
              <option key={z.key} value={z.key}>
                {z.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label>
            Shift start
            <input required type="datetime-local" value={form.shiftStart} onChange={(e) => setForm((f) => ({ ...f, shiftStart: e.target.value }))} />
          </label>
          <label>
            Shift end
            <input required type="datetime-local" value={form.shiftEnd} onChange={(e) => setForm((f) => ({ ...f, shiftEnd: e.target.value }))} />
          </label>
        </div>

        <label>
          Notes
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="(optional)" />
        </label>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="submit" disabled={busy}>
            {form.id ? 'Save changes' : (
              <>
                <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                Add shift
              </>
            )}
          </button>
          {form.id && (
            <button type="button" className="secondary" onClick={() => setForm(emptyForm)}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remove ${pendingDelete?.personName}'s shift?`}
        description="This removes it from the plan — it won't affect anything they've already logged."
        confirmLabel="Remove shift"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
