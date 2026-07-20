import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

/** Custom header shown above every Authenticator screen (sign in, forgot password, forced password change). */
export function AuthHeader() {
  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: 'var(--space-6) var(--space-4) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo height={26} />
        <ThemeToggle />
      </div>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
          margin: 'var(--space-2) 0 var(--space-4)',
        }}
      >
        Incident Management System — Event Control Room
      </p>
    </div>
  );
}
