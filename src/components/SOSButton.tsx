import { useEffect, useState } from 'react';
import { AlertOctagon, X } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { lookupZone } from '../utils/zoneLookup';
import { zoneLabel, type ZoneKey } from '../constants/zones';
import { roleLabel } from '../constants/escalation';
import { pushNotify } from '../utils/pushNotify';
import { enqueueIncident } from '../offline/queue';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Personal panic button — always visible, top-right, for anyone who can log
 * an incident. Skips the narrative form entirely: one confirm tap creates a
 * locked Level 4 incident tagged with the reporter's identity and GPS-derived
 * zone, then fires an urgent+alarm push to every device. Deliberately
 * bypasses the normal Level 1 default and the event-control/fmic-only
 * escalation gate — a genuine personal emergency shouldn't wait for someone
 * else to declare severity.
 */
export function SOSButton() {
  const { user } = useAuth();
  const { activeEvent } = useEvent();
  const { position, capture } = useGeolocation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);

  useEffect(() => {
    if (!sentAt) return;
    const t = setTimeout(() => setSentAt(null), 6000);
    return () => clearTimeout(t);
  }, [sentAt]);

  if (!user || !activeEvent) return null;

  const openConfirm = () => {
    capture();
    setConfirmOpen(true);
  };

  const sendSOS = async () => {
    setSending(true);
    const zone: ZoneKey = (position ? lookupZone(position.lng, position.lat) : null) ?? user.assignedZone ?? 'WholeSite';
    const payload = {
      eventId: activeEvent.id,
      timestamp: new Date().toISOString(),
      category: 'Other' as const,
      zone,
      status: 'Open' as const,
      priority: 'Major' as const,
      escalationLevel: 'Level4' as const,
      loggedByUserId: user.userId,
      loggedByName: user.name,
      loggedByRole: user.role,
      narrative: `SOS — ${user.name} (${roleLabel(user.role)}) triggered an emergency alert. Immediate assistance required.`,
      lat: position?.lat,
      lng: position?.lng,
      updates: [],
      locked: true,
    };

    try {
      if (!navigator.onLine) throw new Error('offline');
      const { data: incident, errors } = await client.models.Incident.create(payload);
      if (!incident) throw new Error(errors?.[0]?.message ?? 'SOS create returned no data');
      void pushNotify(
        'SOS — immediate assistance required',
        `${user.name} triggered an SOS in ${zoneLabel(zone)}.`,
        `/incidents/${incident.id}`,
        true,
        true,
      );
    } catch {
      // Never lose an SOS to a bad connection — queue it like any other incident.
      enqueueIncident(payload);
    } finally {
      setSending(false);
      setConfirmOpen(false);
      setSentAt(Date.now());
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        aria-label="Send SOS — emergency alert"
        title="SOS — emergency alert"
        style={{
          flexShrink: 0,
          minHeight: 32,
          padding: '0 var(--space-3)',
          borderRadius: 999,
          background: 'var(--sev-4-solid)',
          color: '#ffffff',
          border: 'none',
          fontWeight: 800,
          fontSize: 'var(--text-xs)',
          letterSpacing: '0.04em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        <AlertOctagon size={14} /> SOS
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Send SOS?"
        description="This immediately alerts Event Control/FMIC with your name, role, and location as a Critical incident. Only use this for a genuine personal emergency."
        confirmLabel={sending ? 'Sending…' : 'Send SOS'}
        danger
        onConfirm={sendSOS}
        onCancel={() => setConfirmOpen(false)}
      />

      {sentAt && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 'var(--space-4)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'var(--sev-4-solid)',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            boxShadow: 'var(--shadow-card)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            maxWidth: 'calc(100vw - var(--space-4) * 2)',
          }}
        >
          SOS sent — Event Control has been alerted.
          <button
            type="button"
            onClick={() => setSentAt(null)}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
