import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { STAFF_STATUSES, type StaffStatus } from '../constants/staffStatus';
import { setMyStatus } from '../utils/userProfile';

/** Self-service shift-presence toggle for Staff — feeds the FMIC ground roster (FMICGround.tsx). */
export function MyStatusToggle() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const onChange = async (status: StaffStatus) => {
    setBusy(true);
    try {
      await setMyStatus(user.userId, user.name, user.role, status);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="group" aria-label="My status" style={{ display: 'flex', gap: 2 }}>
      {STAFF_STATUSES.map((s) => (
        <button
          key={s.key}
          type="button"
          className={user.status === s.key ? '' : 'secondary'}
          disabled={busy}
          onClick={() => onChange(s.key)}
          style={{ minHeight: 32, padding: '0 var(--space-2)', fontSize: 'var(--text-xs)' }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
