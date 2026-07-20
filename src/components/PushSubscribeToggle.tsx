import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { getExistingSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../utils/pushSubscription';
import { useAuth } from '../context/AuthContext';

/** Lets a device opt in to push alerts for Level 3/4 escalations. */
export function PushSubscribeToggle() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    getExistingSubscription().then((sub) => setSubscribed(!!sub));
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        const ok = await subscribeToPush(user?.userId);
        setSubscribed(ok);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      disabled={busy}
      aria-label={subscribed ? 'Disable push alerts on this device' : 'Enable push alerts for Level 3/4 escalations'}
      title={subscribed ? 'Push alerts on — click to disable' : 'Enable push alerts for Level 3/4 escalations'}
    >
      {subscribed ? <Bell size={18} /> : <BellOff size={18} />}
    </button>
  );
}
