import { Radio } from 'lucide-react';
import { RADIO_CHANNELS } from '../constants/taxonomy';

export function RadioChannelPanel() {
  return (
    <aside
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        fontSize: 'var(--text-sm)',
        background: 'var(--color-surface-raised)',
      }}
    >
      <strong style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
        <Radio size={15} /> Radio channels
      </strong>
      <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 0, listStyle: 'none' }}>
        {Object.entries(RADIO_CHANNELS).map(([ch, label]) => (
          <li
            key={ch}
            className={ch === '5' ? 'mono' : 'mono'}
            style={{
              padding: 'var(--space-1) 0',
              color: ch === '5' ? 'var(--sev-3)' : 'var(--color-text-secondary)',
              fontWeight: ch === '5' ? 700 : 400,
            }}
          >
            {label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
