import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ZONES, type ZoneKey } from '../constants/zones';
import { setMyAssignedZone } from '../utils/userProfile';

/** Self-service zone assignment for Stewards — LiveBoard filters to this zone. */
export function MyZoneSelector() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const onChange = async (zone: ZoneKey) => {
    setBusy(true);
    try {
      await setMyAssignedZone(user.userId, user.name, user.role, zone);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)' }}>
      <MapPin size={14} style={{ color: 'var(--color-text-secondary)' }} />
      <select
        value={user.assignedZone ?? ''}
        disabled={busy}
        onChange={(e) => onChange(e.target.value as ZoneKey)}
        style={{ minHeight: 32, fontSize: 'var(--text-xs)', padding: '0 var(--space-2)' }}
        aria-label="My assigned zone"
      >
        <option value="" disabled>
          Set my zone…
        </option>
        {ZONES.map((z) => (
          <option key={z.key} value={z.key}>
            {z.label}
          </option>
        ))}
      </select>
    </label>
  );
}
