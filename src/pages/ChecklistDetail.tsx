import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Camera, Check } from 'lucide-react';
import { uploadData, getUrl } from 'aws-amplify/storage';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import type { ChecklistInstance, ChecklistInstanceItem } from '../types/checklist';

export function ChecklistDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [instance, setInstance] = useState<ChecklistInstance | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const { data } = await client.models.ChecklistInstance.get({ id: id! });
      if (!cancelled) setInstance(data as unknown as ChecklistInstance);
    }
    load();

    const sub = client.models.ChecklistInstance.onUpdate({ filter: { id: { eq: id } } }).subscribe({
      next: (updated) => setInstance(updated as unknown as ChecklistInstance),
    });
    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (!instance) return;
    instance.items.forEach((item, index) => {
      if (item.photoS3Key && !photoUrls[index]) {
        getUrl({ path: item.photoS3Key }).then(({ url }) => {
          setPhotoUrls((prev) => ({ ...prev, [index]: url.toString() }));
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  if (!instance || !user) return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>Loading…</p>;

  const saveItems = async (items: ChecklistInstanceItem[]) => {
    await client.models.ChecklistInstance.update({ id: instance.id, items });
  };

  const toggleDone = async (index: number) => {
    setBusyIndex(index);
    try {
      const items = instance.items.map((item, i) => {
        if (i !== index) return item;
        const nowDone = item.status !== 'Done';
        return {
          ...item,
          status: (nowDone ? 'Done' : 'Pending') as ChecklistInstanceItem['status'],
          completedBy: nowDone ? user.name : item.completedBy,
          completedAt: nowDone ? new Date().toISOString() : item.completedAt,
        };
      });
      await saveItems(items);
    } finally {
      setBusyIndex(null);
    }
  };

  const capturePhoto = async (index: number, file: File) => {
    setBusyIndex(index);
    try {
      const key = `checklist-photos/${instance.id}/${index}-${Date.now()}-${file.name}`;
      await uploadData({ path: key, data: file }).result;
      const items = instance.items.map((item, i) => (i === index ? { ...item, photoS3Key: key } : item));
      await saveItems(items);
    } finally {
      setBusyIndex(null);
    }
  };

  const setNotes = async (index: number, notes: string) => {
    const items = instance.items.map((item, i) => (i === index ? { ...item, notes } : item));
    await saveItems(items);
  };

  const done = instance.items.filter((i) => i.status === 'Done').length;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
      <Link to="/checklists" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        ← Back to checklists
      </Link>
      <h1 style={{ fontSize: 'var(--text-lg)', marginTop: 'var(--space-2)' }}>{instance.title}</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
        {instance.date} {instance.assignee ? `· Assigned to ${instance.assignee}` : ''}{' '}
        <span className="mono">
          · {done}/{instance.items.length} complete
        </span>
      </p>
      {instance.sourceIncidentId && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
          Created from{' '}
          <Link to={`/incidents/${instance.sourceIncidentId}`} style={{ color: 'inherit' }}>
            incident {instance.sourceIncidentId.slice(0, 8)}
          </Link>
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        {instance.items.map((item, index) => {
          const isDone = item.status === 'Done';
          return (
            <div
              key={index}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                background: isDone ? 'var(--color-surface)' : 'var(--color-surface-raised)',
              }}
            >
              <button
                type="button"
                onClick={() => toggleDone(index)}
                disabled={busyIndex === index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  width: '100%',
                  minHeight: 48,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: `2px solid ${isDone ? 'var(--sev-1)' : 'var(--color-border-strong)'}`,
                    background: isDone ? 'var(--sev-1)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDone && <Check size={18} color="white" />}
                </span>
                <span style={{ fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none' }}>{item.label}</span>
              </button>

              {isDone && item.completedBy && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 'var(--space-2) 0 0 40px' }}>
                  Signed off by {item.completedBy} at{' '}
                  {item.completedAt ? new Date(item.completedAt).toLocaleString('en-GB') : ''}
                </p>
              )}

              {item.requiresPhoto && (
                <div style={{ marginLeft: 40, marginTop: 'var(--space-2)' }}>
                  {photoUrls[index] && (
                    <img
                      src={photoUrls[index]}
                      alt={`Evidence for ${item.label}`}
                      style={{ maxWidth: 200, borderRadius: 'var(--radius-sm)', display: 'block', marginBottom: 'var(--space-2)' }}
                    />
                  )}
                  <label className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 var(--space-3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                    <Camera size={14} />
                    {item.photoS3Key ? 'Retake photo' : 'Take photo'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      disabled={busyIndex === index}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) capturePhoto(index, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              )}

              <div style={{ marginLeft: 40, marginTop: 'var(--space-2)' }}>
                <input
                  defaultValue={item.notes ?? ''}
                  placeholder="Notes (optional)"
                  onBlur={(e) => {
                    if (e.target.value !== (item.notes ?? '')) setNotes(index, e.target.value);
                  }}
                  style={{ fontSize: 'var(--text-sm)', width: '100%' }}
                  aria-label={`Notes for ${item.label}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
