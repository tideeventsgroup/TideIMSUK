import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Server-side only. Called exclusively via the AppSync `triageAssist` resolver
 * (see data/resource.ts) — never invoked directly from the browser, so the
 * Groq key never reaches client code (Build Plan Section 11).
 *
 * Set the real key with: npx ampx sandbox secret set GROQ_API_KEY
 * (or via Secrets Manager in a deployed branch environment).
 */
export const triageAssist = defineFunction({
  name: 'triage-assist',
  entry: './handler.ts',
  timeoutSeconds: 15,
  environment: {
    GROQ_API_KEY: secret('GROQ_API_KEY'),
  },
});
