export function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div
      style={{
        flex: 1,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        background: 'var(--color-surface-raised)',
        textAlign: 'center',
      }}
    >
      <div className="mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: accent }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
