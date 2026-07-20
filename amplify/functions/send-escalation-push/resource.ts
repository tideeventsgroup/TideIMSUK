import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Web Push fan-out — triggered by a custom mutation called from every
 * incident-logging action (new incident, status change, update added,
 * escalation declared; see src/utils/pushNotify.ts) — not a DynamoDB
 * stream trigger, since each of those already has exactly one call site
 * and this is simpler/lower-risk than wiring table streams. Level 3/4
 * declarations (Event Control only) are the one case marked `urgent`.
 */
export const sendEscalationPush = defineFunction({
  name: 'send-escalation-push',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    VAPID_PRIVATE_KEY: secret('VAPID_PRIVATE_KEY'),
    VAPID_PUBLIC_KEY: 'BCetlSWyQ6mOrWjoij8etPyX_Lz5skpL0alE-AkRFpa359R_fuhpsMrWu_e_V8K3Q5b18lR8Xjy0vdKgKoe2CmM',
  },
  // Grouped with the data stack (not its own nested stack) — it's both a
  // custom mutation handler for `data` and granted direct DynamoDB table
  // access in backend.ts, which would otherwise create a circular
  // dependency between the function and data nested stacks.
  resourceGroupName: 'data',
});
