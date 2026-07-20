import { useEffect, useState } from 'react';
import { Wind, AlertTriangle } from 'lucide-react';

// Stranraer/Breastworks approximate coordinates.
const LAT = 54.9058;
const LNG = -5.022;

// Example thresholds only — replace with the certified figures from your
// structural engineer / marquee supplier and the fireworks contractor's
// wind-abort limit before relying on this for a go/no-go decision.
const CAUTION_MPH = 25;
const ACTION_MPH = 40;

interface WindReading {
  tempC: number;
  windMph: number;
  gustMph: number;
  directionDeg: number;
  fetchedAt: string;
}

function directionLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Live wind/weather conditions — ties directly into the OSSP's wind-threshold
 * categories (marquee/wind-threshold breach, fireworks wind-abort decision).
 * Uses Open-Meteo (no API key) for Stranraer/Breastworks.
 */
export function WindConditionsPanel() {
  const [reading, setReading] = useState<WindReading | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=mph&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('weather fetch failed');
        const data = await res.json();
        if (cancelled) return;
        setReading({
          tempC: data.current.temperature_2m,
          windMph: data.current.wind_speed_10m,
          gustMph: data.current.wind_gusts_10m,
          directionDeg: data.current.wind_direction_10m,
          fetchedAt: data.current.time,
        });
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const level = !reading ? null : reading.gustMph >= ACTION_MPH ? 'action' : reading.gustMph >= CAUTION_MPH ? 'caution' : 'normal';
  const color = level === 'action' ? 'var(--sev-3)' : level === 'caution' ? 'var(--sev-2)' : 'var(--color-text-primary)';

  return (
    <aside
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        fontSize: 'var(--text-sm)',
        background: 'var(--color-surface-raised)',
        marginTop: 'var(--space-3)',
      }}
    >
      <strong style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
        <Wind size={15} /> Wind — Stranraer
      </strong>

      {error && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>Unavailable offline.</p>}

      {reading && (
        <>
          <div className="mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color, marginTop: 'var(--space-2)' }}>
            {Math.round(reading.windMph)} mph
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Gusting <span className="mono">{Math.round(reading.gustMph)} mph</span> · {directionLabel(reading.directionDeg)} ·{' '}
            <span className="mono">{Math.round(reading.tempC)}°C</span>
          </div>

          {level !== 'normal' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'var(--space-2)', color, fontWeight: 600, fontSize: 'var(--text-xs)' }}>
              <AlertTriangle size={13} />
              {level === 'action' ? `Gusts at/above ${ACTION_MPH}mph — review structure/fireworks status` : `Approaching ${CAUTION_MPH}mph caution threshold`}
            </div>
          )}
        </>
      )}

      {!reading && !error && <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>Loading…</p>}
    </aside>
  );
}
