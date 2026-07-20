import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { seedChecklistTemplates } from '../utils/seedChecklists';
import type { ChecklistInstance, ChecklistTemplate } from '../types/checklist';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function progress(instance: ChecklistInstance) {
  const total = instance.items.length;
  const done = instance.items.filter((i) => i.status === 'Done').length;
  return { done, total };
}

export function Checklists() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const load = async () => {
    if (!activeEvent) return;
    setLoading(true);
    const [instanceRes, templateRes] = await Promise.all([
      client.models.ChecklistInstance.list({ filter: { eventId: { eq: activeEvent.id } } }),
      client.models.ChecklistTemplate.list(),
    ]);
    const list = (instanceRes.data as unknown as ChecklistInstance[]).sort((a, b) => (a.date < b.date ? 1 : -1));
    setInstances(list);
    setTemplates(templateRes.data as unknown as ChecklistTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id]);

  if (user && user.role !== 'event-control' && user.role !== 'fmic') {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        Only Event Control/FMIC can access checklists.
      </p>
    );
  }

  if (!activeEvent) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>No event configured yet.</p>;
  }

  const runSeed = async () => {
    setSeeding(true);
    try {
      await seedChecklistTemplates();
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const startFromTemplate = async (template: ChecklistTemplate) => {
    setStarting(template.id);
    try {
      await client.models.ChecklistInstance.create({
        eventId: activeEvent.id,
        templateId: template.id,
        title: template.name,
        date: todayIso(),
        items: template.items.map((item) => ({
          label: item.label,
          requiresPhoto: item.requiresPhoto,
          requiresSignoff: item.requiresSignoff,
          status: 'Pending',
        })),
      });
      await load();
    } finally {
      setStarting(null);
    }
  };

  const today = instances.filter((i) => i.date === todayIso());
  const earlier = instances.filter((i) => i.date !== todayIso());

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ListChecks size={20} /> Checklists
        </h1>
        {user?.role === 'event-control' && (
          <button type="button" className="secondary" onClick={runSeed} disabled={seeding}>
            {seeding ? 'Seeding…' : 'Seed default templates'}
          </button>
        )}
      </div>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Start from template</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {templates.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--space-3)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
            }}
          >
            <div>
              <strong>{t.name}</strong>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {t.items.length} items{t.recurring ? ' · daily' : ''}
              </div>
            </div>
            <button type="button" onClick={() => startFromTemplate(t)} disabled={starting === t.id}>
              <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {starting === t.id ? 'Starting…' : 'Start today'}
            </button>
          </div>
        ))}
        {templates.length === 0 && !loading && (
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No templates yet — seed the defaults above.</p>
        )}
      </div>

      <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Today</h2>
      <ChecklistInstanceList instances={today} emptyLabel="No checklist instances for today yet." />

      {earlier.length > 0 && (
        <>
          <h2 style={{ fontSize: 'var(--text-base)', marginTop: 'var(--space-6)' }}>Earlier</h2>
          <ChecklistInstanceList instances={earlier} emptyLabel="" />
        </>
      )}

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
    </div>
  );
}

function ChecklistInstanceList({ instances, emptyLabel }: { instances: ChecklistInstance[]; emptyLabel: string }) {
  if (instances.length === 0) {
    return emptyLabel ? <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>{emptyLabel}</p> : null;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {instances.map((instance) => {
        const { done, total } = progress(instance);
        const complete = total > 0 && done === total;
        return (
          <Link
            key={instance.id}
            to={`/checklists/${instance.id}`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--space-3)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              textDecoration: 'none',
              color: 'var(--color-text-primary)',
              background: complete ? 'var(--color-surface)' : 'var(--color-surface-raised)',
              minHeight: 44,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <strong>{instance.title}</strong>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {instance.date} {instance.assignee ? `· ${instance.assignee}` : ''}
                {instance.sourceIncidentId ? ' · from incident' : ''}
              </div>
            </div>
            <span
              className="mono"
              style={{
                fontSize: 'var(--text-sm)',
                color: complete ? 'var(--sev-1)' : 'var(--color-text-secondary)',
                fontWeight: 700,
              }}
            >
              {done}/{total}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
