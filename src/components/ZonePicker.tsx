import { ZONES, type ZoneKey } from '../constants/zones';

export function ZonePicker({
  value,
  onChange,
  autoSuggested,
}: {
  value: ZoneKey;
  onChange: (zone: ZoneKey) => void;
  autoSuggested?: ZoneKey | null;
}) {
  return (
    <label>
      Zone
      <select value={value} onChange={(e) => onChange(e.target.value as ZoneKey)}>
        {ZONES.map((z) => (
          <option key={z.key} value={z.key}>
            {z.label}
            {z.key === autoSuggested ? ' (GPS suggested)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
