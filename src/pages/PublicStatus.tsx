import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';

const client = generateClient<Schema>({ authMode: 'iam' });

const REFRESH_MS = 60_000;

interface StatusResult {
  eventName: string | null;
  status: string;
  message: string;
}

export function PublicStatus() {
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await client.queries.publicEventStatus();
        if (!cancelled && data) {
          setResult(data as unknown as StatusResult);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const advisory = result?.status === 'Advisory';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Logo />
        <ThemeToggle />
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-6) var(--space-4)',
          textAlign: 'center',
          gap: 'var(--space-4)',
        }}
      >
        {!result && !error && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--color-text-secondary)' }}>Status unavailable right now — please check again shortly.</p>}
        {result && (
          <>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: advisory ? 'var(--sev-3)' : 'var(--color-success, #16a34a)',
              }}
              aria-hidden="true"
            />
            <h1 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>{advisory ? 'Advisory in effect' : 'All clear'}</h1>
            {result.eventName && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)', margin: 0 }}>{result.eventName}</p>
            )}
            <p style={{ maxWidth: 480, fontSize: 'var(--text-base)' }}>{result.message}</p>
          </>
        )}
      </main>

      <footer style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
        Tide Events Group Scotland — automatically refreshes.
      </footer>
    </div>
  );
}
