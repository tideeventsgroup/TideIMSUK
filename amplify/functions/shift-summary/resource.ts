import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Server-side only, same pattern as triage-assist. Drafts the shift
 * handover / debrief summary from structured incident data (Build Plan
 * Section 11) — never invoked directly from the browser.
 */
export const shiftSummary = defineFunction({
  name: 'shift-summary',
  entry: './handler.ts',
  timeoutSeconds: 20,
  environment: {
    GROQ_API_KEY: secret('GROQ_API_KEY'),
  },
});
