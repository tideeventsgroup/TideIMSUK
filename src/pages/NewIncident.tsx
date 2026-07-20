import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, AlertCircle, ShieldAlert, Camera, X, Loader2, RotateCcw } from 'lucide-react';
import { uploadData } from 'aws-amplify/storage';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { lookupZone } from '../utils/zoneLookup';
import { CATEGORIES, categoryLabel, type CategoryKey } from '../constants/taxonomy';
import { ZonePicker } from '../components/ZonePicker';
import { zoneLabel, type ZoneKey } from '../constants/zones';
import type { Priority } from '../types/incident';
import type { Risk } from '../types/risk';
import { enqueueIncident } from '../offline/queue';
import { TriageSuggest, type AppliedFields } from '../components/TriageSuggest';
import { pushNotify } from '../utils/pushNotify';

const LAST_INCIDENT_KEY = 'tide-ims-last-incident';

interface LastIncident {
  category: CategoryKey;
  zone: ZoneKey;
}

function readLastIncident(): LastIncident | null {
  try {
    const raw = localStorage.getItem(LAST_INCIDENT_KEY);
    return raw ? (JSON.parse(raw) as LastIncident) : null;
  } catch {
    return null;
  }
}

function writeLastIncident(entry: LastIncident) {
  try {
    localStorage.setItem(LAST_INCIDENT_KEY, JSON.stringify(entry));
  } catch {
    // best effort — not critical if this doesn't persist
  }
}

export function NewIncident() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const navigate = useNavigate();
  const { position, status: geoStatus, capture } = useGeolocation();
  const lastIncident = useRef(readLastIncident()).current;

  const [category, setCategory] = useState<CategoryKey>('Other');
  const [subcategory, setSubcategory] = useState('');
  // Falls back to wherever the last incident was logged rather than a fixed
  // default — most incidents cluster near the last one (Section: GPS fallback).
  const [zone, setZone] = useState<ZoneKey>(lastIncident?.zone ?? 'WholeSite');
  const [priority, setPriority] = useState<Priority>('Standard');
  const [narrative, setNarrative] = useState('');
  const [radioChannel, setRadioChannel] = useState<number | null>(null);
  const [assignedAgency, setAssignedAgency] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [linkedRiskIds, setLinkedRiskIds] = useState<string[]>([]);
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gpsRequested = useRef(false);
  const zoneTouched = useRef(false);

  const suggestedZone = position ? lookupZone(position.lng, position.lat) : null;
  const categoryDef = CATEGORIES.find((c) => c.key === category);

  useEffect(() => {
    if (!activeEvent) return;
    client.models.Risk.list({ filter: { eventId: { eq: activeEvent.id } } }).then(({ data }) => {
      setRisks(data as unknown as Risk[]);
    });
  }, [activeEvent?.id]);

  // GPS cross-checks the zone silently once a fix comes in — but only until
  // the Loggist has touched the zone picker themselves, so it never stomps
  // a manual choice.
  useEffect(() => {
    if (suggestedZone && !zoneTouched.current) setZone(suggestedZone);
  }, [suggestedZone]);

  const suggestedRisks = risks.filter((r) => r.linkedCategories?.includes(category));
  const otherRisks = risks.filter((r) => !r.linkedCategories?.includes(category));

  const toggleRisk = (id: string) => {
    setLinkedRiskIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  if (!activeEvent) {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        No event configured yet — an Admin needs to set one up before incidents can be logged.
      </p>
    );
  }

  const handleCategoryChange = (key: CategoryKey) => {
    setCategory(key);
    setSubcategory('');
    const def = CATEGORIES.find((c) => c.key === key);
    if (def?.defaultRadioChannel) setRadioChannel(def.defaultRadioChannel);
    if (def) setPriority(def.defaultPriority);
  };

  // GPS fires the moment the narrative gets focus — no separate "Capture
  // GPS" step to tap mid-incident. Guarded so it only asks once per visit;
  // the small status line below still offers a manual retry if it fails.
  const onNarrativeFocus = () => {
    if (gpsRequested.current) return;
    gpsRequested.current = true;
    capture();
  };

  const applyRepeatLast = () => {
    if (!lastIncident) return;
    handleCategoryChange(lastIncident.category);
    zoneTouched.current = true;
    setZone(lastIncident.zone);
  };

  const applyAiFields = (fields: AppliedFields) => {
    if (fields.category) handleCategoryChange(fields.category);
    if (fields.subcategory) setSubcategory(fields.subcategory);
    if (fields.zone) {
      zoneTouched.current = true;
      setZone(fields.zone);
    }
    if (fields.priority) setPriority(fields.priority);
    if (fields.radioChannel) setRadioChannel(fields.radioChannel);
    if (fields.assignedAgency) setAssignedAgency(fields.assignedAgency);
    if (fields.narrative) setNarrative(fields.narrative);
    if (fields.riskRefs?.length) {
      const ids = risks.filter((r) => fields.riskRefs!.includes(r.ref)).map((r) => r.id);
      setLinkedRiskIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const key = `incident-photos/${activeEvent.id}/${Date.now()}-${file.name}`;
          await uploadData({ path: key, data: file }).result;
          return key;
        })
      );
      setPhotoKeys((prev) => [...prev, ...uploaded]);
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (key: string) => {
    setPhotoKeys((prev) => prev.filter((k) => k !== key));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeEvent) return;

    setSubmitting(true);
    setError(null);

    // Client-set timestamp: required for offline-first logging, since a
    // device may write while disconnected and sync later (Section 2/4).
    const payload = {
      eventId: activeEvent.id,
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
      assignedAgency: assignedAgency || undefined,
      narrative,
      radioChannel: radioChannel ?? undefined,
      lat: position?.lat,
      lng: position?.lng,
      updates: [],
      attachmentKeys: photoKeys.length ? photoKeys : undefined,
      locked: false,
      // Stores risk refs (e.g. "R04"), not Risk table PKs — human-readable on the
      // incident card/PDF/CSV without a join, matching how OSSP documents cite hazards.
      linkedRiskIds: linkedRiskIds.length
        ? risks.filter((r) => linkedRiskIds.includes(r.id)).map((r) => r.ref)
        : undefined,
    };

    // A dropdown never blocks the log from existing: this write happens
    // (online or queued) before anything else, regardless of whether AI
    // suggestions have arrived or been reviewed.
    writeLastIncident({ category, zone });

    if (!navigator.onLine) {
      enqueueIncident(payload);
      navigate('/');
      return;
    }

    try {
      const { data: created, errors } = await client.models.Incident.create(payload);
      if (!created) {
        // client.models.X.create() resolves (doesn't throw) on GraphQL/authorization
        // errors — data is just null. Treat that the same as a thrown network error:
        // queue it locally rather than silently navigating away as if it worked.
        throw new Error(errors?.[0]?.message ?? 'Incident create returned no data');
      }
      if (linkedRiskIds.length) {
        // Denormalized back-reference for the risk register's "incidents per ref" view.
        // Best-effort only — not queued offline, since it touches other parties' records.
        await Promise.all(
          linkedRiskIds.map(async (riskId) => {
            const { data: risk } = await client.models.Risk.get({ id: riskId });
            if (!risk) return;
            await client.models.Risk.update({
              id: riskId,
              linkedIncidentIds: [...(risk.linkedIncidentIds ?? []), created.id],
            });
          })
        );
      }
      void pushNotify(
        'New incident logged',
        `${categoryLabel(category)} — ${zoneLabel(zone)}. ${narrative.slice(0, 120)}`,
        `/incidents/${created.id}`,
      );
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

      {lastIncident && (
        <button
          type="button"
          className="secondary"
          onClick={applyRepeatLast}
          style={{ alignSelf: 'flex-start', minHeight: 36, padding: '0 var(--space-3)', fontSize: 'var(--text-sm)' }}
        >
          <RotateCcw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Repeat last: {categoryLabel(lastIncident.category)} · {zoneLabel(lastIncident.zone)}
        </button>
      )}

      {/* Capture first, structure second — one field to get the report down,
          everything else is a fast-follow the Loggist can ignore under pressure. */}
      <label>
        Narrative
        <textarea
          autoFocus
          required
          rows={5}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          onFocus={onNarrativeFocus}
          placeholder="Type — or dictate — what's happening, even roughly. e.g. &quot;crowd building fast at the oyster bar queue, getting pushed toward the walkway, zone b&quot;"
          style={{ fontSize: 'var(--text-base)' }}
        />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: -8 }}>
        <MapPin size={13} />
        {geoStatus === 'idle' && 'Location captures automatically once you start typing.'}
        {geoStatus === 'locating' && 'Locating…'}
        {geoStatus === 'denied' && (
          <>
            Location denied — zone defaults to your last incident.{' '}
            <button type="button" onClick={capture} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
              Retry
            </button>
          </>
        )}
        {geoStatus === 'unavailable' && 'GPS unavailable on this device — zone defaults to your last incident.'}
        {position && (
          <span className="mono">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </span>
        )}
      </div>

      <TriageSuggest narrative={narrative} riskContext={risks.map((r) => ({ ref: r.ref, hazard: r.hazard }))} onApply={applyAiFields} />

      <button type="submit" disabled={submitting || !narrative || photoUploading} style={{ minHeight: 52, fontSize: 'var(--text-base)' }}>
        {submitting ? 'Logging…' : 'Log incident'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-2) 0 calc(-1 * var(--space-2))' }}>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Add detail (optional)
        </span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--color-border)' }} />
      </div>

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

      <ZonePicker
        value={zone}
        onChange={(z) => {
          zoneTouched.current = true;
          setZone(z);
        }}
        autoSuggested={suggestedZone}
      />

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
        Assigned agency <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(optional)</span>
        <input
          value={assignedAgency}
          onChange={(e) => setAssignedAgency(e.target.value)}
          placeholder="e.g. Police Scotland, SAS, Fire Service"
        />
      </label>

      <div>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block', marginBottom: 'var(--space-1)' }}>
          Photo evidence <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(optional)</span>
        </span>
        {photoKeys.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            {photoKeys.map((key) => (
              <span
                key={key}
                className="mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-strong)',
                }}
              >
                {key.split('/').pop()}
                <button
                  type="button"
                  onClick={() => removePhoto(key)}
                  aria-label={`Remove photo ${key}`}
                  style={{ display: 'inline-flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <label
          className="secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 40,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            cursor: photoUploading ? 'default' : 'pointer',
            fontSize: 'var(--text-sm)',
            opacity: photoUploading ? 0.6 : 1,
          }}
        >
          {photoUploading ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
          {photoUploading ? 'Uploading…' : 'Add photo'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={photoUploading}
            style={{ display: 'none' }}
            onChange={(e) => addPhotos(e.target.files)}
          />
        </label>
      </div>

      {risks.length > 0 && (
        <div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={14} /> Linked risk register refs
          </span>
          {suggestedRisks.length > 0 && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: '2px 0 6px' }}>
              Suggested for {categoryLabel(category)}:
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {[...suggestedRisks, ...otherRisks].map((r) => {
              const active = linkedRiskIds.includes(r.id);
              const suggested = suggestedRisks.includes(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={active ? '' : 'secondary'}
                  onClick={() => toggleRisk(r.id)}
                  title={r.hazard}
                  style={{
                    minHeight: 32,
                    padding: '0 var(--space-2)',
                    fontSize: 'var(--text-xs)',
                    borderStyle: suggested && !active ? 'dashed' : 'solid',
                  }}
                >
                  {r.ref}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </form>
  );
}
