import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, AlertCircle } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { lookupZone } from '../utils/zoneLookup';
import { CATEGORIES, type CategoryKey } from '../constants/taxonomy';
import { ZonePicker } from '../components/ZonePicker';
import type { ZoneKey } from '../constants/zones';
import type { Priority } from '../types/incident';
import { enqueueIncident } from '../offline/queue';

const DEFAULT_EVENT_ID = import.meta.env.VITE_EVENT_ID ?? 'default-event';

export function NewIncident() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { position, status: geoStatus, capture } = useGeolocation();

  const [category, setCategory] = useState<CategoryKey>('Other');
  const [subcategory, setSubcategory] = useState('');
  const [zone, setZone] = useState<ZoneKey>('WholeSite');
  const [priority, setPriority] = useState<Priority>('Standard');
  const [narrative, setNarrative] = useState('');
  const [radioChannel, setRadioChannel] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedZone = position ? lookupZone(position.lng, position.lat) : null;
  const categoryDef = CATEGORIES.find((c) => c.key === category);

  const handleCategoryChange = (key: CategoryKey) => {
    setCategory(key);
    setSubcategory('');
    const def = CATEGORIES.find((c) => c.key === key);
    if (def?.defaultRadioChannel) setRadioChannel(def.defaultRadioChannel);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError(null);

    // Client-set timestamp: required for offline-first logging, since a
    // device may write while disconnected and sync later (Section 2/4).
    const payload = {
      eventId: DEFAULT_EVENT_ID,
      timestamp: new Date().toISOString(),
      category,
      subcategory: subcategory || undefined,
      zone,
      status: 'Open' as const,
      priority,
      escalationLevel: 'Level1' as const,
      loggedByUserId: user.userId,
      loggedByName: user.name,
      loggedByRole: user.role,
      narrative,
      radioChannel: radioChannel ?? undefined,
      lat: position?.lat,
      lng: position?.lng,
      updates: [],
      locked: false,
    };

    if (!navigator.onLine) {
      enqueueIncident(payload);
      navigate('/');
      return;
    }

    try {
      await client.models.Incident.create(payload);
      navigate('/');
    } catch {
      // Network/server failure — queue locally rather than losing the report.
      enqueueIncident(payload);
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <h1 style={{ fontSize: 'var(--text-lg)' }}>Log incident</h1>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--color-danger)',
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <label>
        Category
        <select value={category} onChange={(e) => handleCategoryChange(e.target.value as CategoryKey)}>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {categoryDef && categoryDef.subcategories.length > 0 && (
        <label>
          Subcategory
          <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="">— select —</option>
            {categoryDef.subcategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <button type="button" className="secondary" onClick={capture}>
          <MapPin size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
          Capture GPS
        </button>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          {geoStatus === 'locating' && 'Locating…'}
          {geoStatus === 'denied' && 'Location denied — select zone manually.'}
          {geoStatus === 'unavailable' && 'GPS unavailable — select zone manually.'}
          {position && (
            <span className="mono">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </span>
          )}
        </div>
      </div>

      <ZonePicker value={zone} onChange={setZone} autoSuggested={suggestedZone} />

      <label>
        Priority
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="Standard">Standard</option>
          <option value="Major">Major</option>
        </select>
      </label>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
        New incidents log at Level 1. Mark <strong>Major</strong> priority to flag urgency — only a
        Controller/Admin can then declare Level 2–4 from the incident page (OSSP Section 5.2: Tide
        declares incident level, not ground staff).
      </p>

      <label>
        Radio channel
        <input
          type="number"
          min={1}
          max={5}
          value={radioChannel ?? ''}
          onChange={(e) => setRadioChannel(e.target.value ? Number(e.target.value) : null)}
        />
      </label>

      <label>
        Narrative
        <textarea required rows={4} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
      </label>

      <button type="submit" disabled={submitting || !narrative}>
        {submitting ? 'Logging…' : 'Log incident'}
      </button>
    </form>
  );
}
