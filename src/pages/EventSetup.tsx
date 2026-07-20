import { useState } from 'react';
import { CheckCircle2, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { client } from '../data/client';
import { ZONES, type ZoneKey } from '../constants/zones';
import type { EventInfo } from '../types/event';

const emptyForm = { id: null as string | null, name: '', venue: '', startDate: '', endDate: '', zones: [] as ZoneKey[] };

/**
 * Event Control only: configure the Event(s) this device logs incidents
 * against. Replaces manually writing a GraphQL mutation in the AppSync
 * console — the previous only way to seed an Event for the app to work at all.
 */
export function EventSetup() {
  const { user } = useAuth();
  const { events, activeEvent, setActiveEventId, refresh, loading } = useEvent();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.role !== 'event-control') {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        Only Event Control can access event setup.
      </p>
    );
  }

  const toggleZone = (zone: ZoneKey) => {
    setForm((f) => ({ ...f, zones: f.zones.includes(zone) ? f.zones.filter((z) => z !== zone) : [...f.zones, zone] }));
  };

  const startEdit = (event: EventInfo) => {
    setForm({
      id: event.id,
      name: event.name,
      venue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
      zones: (event.zones ?? []) as ZoneKey[],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (form.id) {
        await client.models.Event.update({
          id: form.id,
          name: form.name,
          venue: form.venue,
          startDate: form.startDate,
          endDate: form.endDate,
          zones: form.zones,
        });
      } else {
        const { data, errors } = await client.models.Event.create({
          name: form.name,
          venue: form.venue,
          startDate: form.startDate,
          endDate: form.endDate,
          zones: form.zones,
        });
        if (errors?.length) throw new Error(errors[0].message);
        if (data?.id) setActiveEventId(data.id);
      }
      await refresh();
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-lg)' }}>Event setup</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        Every device reads/writes incidents against the <strong>active event</strong> selected below. Create a new
        event for each Tide engagement — the app is reusable across future events, not just this one (Build Plan
        Section 3).
      </p>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Events</h2>
      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
      {!loading && events.length === 0 && <p style={{ color: 'var(--color-text-tertiary)' }}>No events yet — create one below.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {events.map((event) => (
          <div
            key={event.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--space-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              background: 'var(--color-surface-raised)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong>{event.name}</strong>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                {event.venue} · <span className="mono">{event.startDate} – {event.endDate}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              {activeEvent?.id === event.id ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-brand)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Active
                </span>
              ) : (
                <button type="button" className="secondary" onClick={() => setActiveEventId(event.id)}>
                  Set active
                </button>
              )}
              <button type="button" className="icon-button" onClick={() => startEdit(event)} aria-label={`Edit ${event.name}`}>
                <Pencil size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>{form.id ? 'Edit event' : 'New event'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}

        <label>
          Name
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Stranraer Oyster Festival 2026" />
        </label>

        <label>
          Venue
          <input required value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="e.g. Breastworks, Stranraer" />
        </label>

        <div className="field-row">
          <label>
            Start date
            <input required type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </label>
          <label>
            End date
            <input required type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </label>
        </div>

        <div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Zones in use</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            {ZONES.map((z) => {
              const active = form.zones.includes(z.key);
              return (
                <button
                  key={z.key}
                  type="button"
                  className={active ? '' : 'secondary'}
                  onClick={() => toggleZone(z.key)}
                  style={{ minHeight: 36, padding: '0 var(--space-3)', fontSize: 'var(--text-xs)' }}
                >
                  {z.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="submit" disabled={busy}>
            {form.id ? 'Save changes' : (
              <>
                <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                Create event
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
    </div>
  );
}
