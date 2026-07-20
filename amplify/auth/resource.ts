import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito user pool for Tide IMS.
 * Groups mirror the OSSP command structure (Section 5.2 / 8):
 * only Controller/Admin may declare Level 3/4 incidents — enforced again
 * in data/resource.ts authorization rules, not just in the UI.
 *
 * Medical is a discipline-scoped viewer role (WeTrack-inspired role-scoped
 * views): sees only category:Medical incidents, client-side filtered —
 * see src/context/AuthContext.tsx / LiveBoard.tsx for the caveat that this
 * is a view restriction, not row-level server-side security (same
 * limitation already flagged for the Level 4 lock).
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['Admin', 'Controller', 'Loggist', 'Steward', 'Medical'],
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
