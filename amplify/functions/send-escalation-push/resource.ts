import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Web Push fan-out for Level 3/4 declarations. Triggered by a custom
 * mutation called from the client at the moment a Controller/Admin
 * declares Level 3/4 (IncidentDetail.tsx `declareLevel`) — not a DynamoDB
 * stream trigger, since escalation declaration already has exactly one
 * call site and this is simpler/lower-risk than wiring table streams.
 */
export const sendEscalationPush = defineFunction({
  name: 'send-escalation-push',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    VAPID_PRIVATE_KEY: secret('VAPID_PRIVATE_KEY'),
    VAPID_PUBLIC_KEY: 'BIamM5rx-m24Bktr9XS9X0BVZbmnNM5fLw8VJhBBHRplbXW1gfbw-yh2249o0lhBkG2AHrX4bdETBaY78JzI25U',
  },
});
