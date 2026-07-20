import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito user pool for Tide IMS.
 * Groups mirror the OSSP command structure (Section 5.2 / 8):
 * only Controller/Admin may declare Level 3/4 incidents — enforced again
 * in data/resource.ts authorization rules, not just in the UI.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['Admin', 'Controller', 'Loggist', 'Steward'],
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
