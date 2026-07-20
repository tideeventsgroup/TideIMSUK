import { useEffect, useState } from 'react';
import { ShieldAlert, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { client } from '../data/client';
import { seedRiskRegisterForEvent } from '../utils/seedRiskRegister';
import { categoryLabel, CATEGORIES, type CategoryKey } from '../constants/taxonomy';
import type { Risk, ResidualRating } from '../types/risk';

const RATING_COLOR: Record<ResidualRating, string> = {
  Low: 'var(--sev-1)',
  Medium: 'var(--sev-2)',
  High: 'var(--sev-3)',
  Critical: 'var(--sev-4)',
};

const emptyForm = {
  ref: '',
  hazard: '',
  likelihood: 3,
  consequence: 3,
  residualRating: 'Medium' as ResidualRating,
  controlsText: '',
  linkedCategories: [] as CategoryKey[],
};

export function RiskRegister() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!activeEvent) return;
    setLoading(true);
    const { data } = await client.models.Risk.list({ filter: { eventId: { eq: activeEvent.id } } });
    setRisks((data as unknown as Risk[]).sort((a, b) => a.ref.localeCompare(b.ref)));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id]);

  if (user && user.role !== 'event-control') {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        Only Event Control can access the risk register.
      </p>
    );
  }

  if (!activeEvent) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>No event configured yet.</p>;
  }

  const runSeed = async () => {
    setSeeding(true);
    try {
      await seedRiskRegisterForEvent(activeEvent.id);
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const toggleControl = async (risk: Risk, index: number) => {
    const controls = risk.controls.map((c, i) => (i === index ? { ...c, checked: !c.checked } : c));
    await client.models.Risk.update({ id: risk.id, controls });
    setRisks((prev) => prev.map((r) => (r.id === risk.id ? { ...r, controls } : r)));
  };

  const createRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    const controls = form.controlsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label) => ({ label, checked: false }));
    await client.models.Risk.create({
      eventId: activeEvent.id,
      ref: form.ref,
      hazard: form.hazard,
      likelihood: form.likelihood,
      consequence: form.consequence,
      score: form.likelihood * form.consequence,
      controls,
      residualRating: form.residualRating,
      linkedIncidentIds: [],
      linkedCategories: form.linkedCategories,
    });
    setForm(emptyForm);
    setShowForm(false);
    await load();
  };

  const maxLinked = Math.max(1, ...risks.map((r) => r.linkedIncidentIds?.length ?? 0));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={20} /> Risk register
        </h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button type="button" className="secondary" onClick={runSeed} disabled={seeding}>
            <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            {seeding ? 'Seeding…' : 'Seed R01–R14'}
          </button>
          <button type="button" onClick={() => setShowForm((s) => !s)}>
            <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Add risk
          </button>
        </div>
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        Seeded from Tide's OSSP hazard register as a starting point — review ratings/controls against the real
        document before relying on them for a live event.
      </p>

      {showForm && (
        <form onSubmit={createRisk} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
          <div className="field-row">
            <label style={{ flex: '0 1 100px' }}>
              Ref
              <input required value={form.ref} onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))} placeholder="R15" />
            </label>
            <label style={{ flex: '3 1 200px' }}>
              Hazard
              <input required value={form.hazard} onChange={(e) => setForm((f) => ({ ...f, hazard: e.target.value }))} />
            </label>
          </div>
          <div className="field-row">
            <label>
              Likelihood (1-5)
              <input required type="number" min={1} max={5} value={form.likelihood} onChange={(e) => setForm((f) => ({ ...f, likelihood: Number(e.target.value) }))} />
            </label>
            <label>
              Consequence (1-5)
              <input required type="number" min={1} max={5} value={form.consequence} onChange={(e) => setForm((f) => ({ ...f, consequence: Number(e.target.value) }))} />
            </label>
            <label>
              Residual rating
              <select value={form.residualRating} onChange={(e) => setForm((f) => ({ ...f, residualRating: e.target.value as ResidualRating }))}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </label>
          </div>
          <label>
            Controls (one per line, becomes a checklist)
            <textarea rows={3} value={form.controlsText} onChange={(e) => setForm((f) => ({ ...f, controlsText: e.target.value }))} />
          </label>
          <div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Auto-suggest for categories</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              {CATEGORIES.map((c) => {
                const active = form.linkedCategories.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={active ? '' : 'secondary'}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        linkedCategories: active ? f.linkedCategories.filter((k) => k !== c.key) : [...f.linkedCategories, c.key],
                      }))
                    }
                    style={{ minHeight: 32, padding: '0 var(--space-2)', fontSize: 'var(--text-xs)' }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="submit">Create risk</button>
            <button type="button" className="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Incidents per risk ref</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {risks.map((r) => {
          const count = r.linkedIncidentIds?.length ?? 0;
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ width: 100, fontSize: 'var(--text-sm)', flexShrink: 0 }} className="mono">
                {r.ref}
              </div>
              <div style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', height: 8 }}>
                <div style={{ width: `${(count / maxLinked) * 100}%`, background: RATING_COLOR[r.residualRating], height: '100%', borderRadius: 'var(--radius-sm)' }} />
              </div>
              <div className="mono" style={{ width: 20, textAlign: 'right', fontSize: 'var(--text-sm)' }}>
                {count}
              </div>
            </div>
          );
        })}
        {risks.length === 0 && !loading && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No risks yet — seed the register above.</p>}
      </div>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Register</h2>
      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {risks.map((r) => (
          <div key={r.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', background: 'var(--color-surface-raised)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <div>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {r.ref}
                </span>{' '}
                <strong>{r.hazard}</strong>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Likelihood {r.likelihood} × Consequence {r.consequence} = Score {r.score} · Linked to:{' '}
                  {r.linkedCategories.map(categoryLabel).join(', ') || 'none'}
                </div>
              </div>
              <span
                className="severity-badge severity-badge--sm"
                style={{ color: RATING_COLOR[r.residualRating], background: 'var(--color-surface)', borderColor: RATING_COLOR[r.residualRating] }}
              >
                {r.residualRating}
              </span>
            </div>
            {r.controls.length > 0 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Controls</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {r.controls.map((c, i) => (
                    <label key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', fontWeight: 400 }}>
                      <input type="checkbox" checked={c.checked} onChange={() => toggleControl(r, i)} style={{ width: 16, height: 16 }} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
