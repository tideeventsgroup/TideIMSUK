import { RADIO_CHANNELS } from '../constants/taxonomy';

export function RadioChannelPanel() {
  return (
    <aside style={{ border: '1px solid #ddd', borderRadius: 4, padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
      <strong>Radio channels</strong>
      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
        {Object.entries(RADIO_CHANNELS).map(([ch, label]) => (
          <li key={ch}>{label}</li>
        ))}
      </ul>
    </aside>
  );
}
