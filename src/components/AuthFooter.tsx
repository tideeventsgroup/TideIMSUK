import { AuthDisclaimer } from './AuthDisclaimer';

/**
 * Full-width banner shown at the bottom of every Authenticator screen.
 * Breaks out of the (narrow, centered) Authenticator container to span
 * the full viewport width via the negative-margin full-bleed trick.
 */
export function AuthFooter() {
  return (
    <div
      style={{
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginTop: 'var(--space-8)',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: 'var(--space-4) var(--space-6)',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <AuthDisclaimer />
      </div>
    </div>
  );
}
