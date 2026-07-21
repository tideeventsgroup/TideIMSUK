export function BreakdownList({ title, entries, labeler }: { title: string; entries: [string, number][]; labeler: (k: string) => string }) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-base)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 160, fontSize: 'var(--text-sm)', flexShrink: 0 }}>{labeler(k)}</div>
            <div style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', height: 8 }}>
              <div
                style={{
                  width: `${(v / max) * 100}%`,
                  background: 'var(--color-accent)',
                  height: '100%',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </div>
            <div className="mono" style={{ width: 24, textAlign: 'right', fontSize: 'var(--text-sm)' }}>
              {v}
            </div>
          </div>
        ))}
        {entries.length === 0 && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>None.</p>}
      </div>
    </div>
  );
}
