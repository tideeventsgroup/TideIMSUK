import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito user pool for Tide IMS.
 * Four-role model, replacing the earlier five-role (Admin/Controller/
 * Loggist/Steward/Medical) scheme:
 *   - event-control: full admin (Kyle / Operational Safety Commander) —
 *     user management, risk register CRUD, checklist template management,
 *     event setup, declares Level 3/4 (OSSP Section 5.2).
 *   - fmic: all operational features except admin — declares Level 1/2
 *     only, Level 3/4 stays with event-control.
 *   - staff: ground roles (security/stewards/medical/bar/volunteers) —
 *     scoped to their own zone's incidents + messaging only.
 *   - view-only: read-only (Event Director/SDT/external partners) — no
 *     create/edit, no messaging.
 * Enforced server-side in data/resource.ts authorization rules, not just
 * hidden in the UI — a lost/borrowed staff device calling a Level 4
 * declare gets rejected by the API itself.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['event-control', 'fmic', 'staff', 'view-only'],
  multifactor: {
    mode: 'OPTIONAL',
    totp: true,
  },
  userAttributes: {
    fullname: {
      required: true,
      mutable: true,
    },
  },
});
