import { ShieldAlert } from 'lucide-react';

/**
 * Authorized-use / monitoring notice shown on every auth screen (sign in,
 * forgot password, forced password change) — standard practice for a
 * system handling incident data shared with multi-agency partners
 * (Police Scotland, SFRS, SAS). Not a substitute for a real data
 * protection/AUP review before go-live; wording here is a starting point.
 */
export function AuthDisclaimer() {
  return (
    <div role="note" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
      <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1, color: 'var(--color-brand)' }} aria-hidden="true" />
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>Authorised use only.</strong> This system is
        restricted to Tide Events Group Scotland control room staff and approved multi-agency partners. It
        holds live incident data, which may include personal and sensitive information, under Tide's
        Operational Safety &amp; Security Plan. Sign-ins and incident log activity are timestamped and
        recorded for audit purposes. Do not share your login. Report suspected unauthorised access
        immediately. Continuing past this point confirms you are an authorised user and accept these terms.
      </p>
    </div>
  );
}
