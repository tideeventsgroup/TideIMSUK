import { useState } from 'react';

interface GeoResult {
  lat: number;
  lng: number;
}

/**
 * Captures GPS on demand (Section 10). Falls back gracefully — never
 * blocks logging if permission is denied or signal is poor.
 */
export function useGeolocation() {
  const [position, setPosition] = useState<GeoResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'done' | 'denied' | 'unavailable'>('idle');

  const capture = () => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('done');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return { position, status, capture };
}
