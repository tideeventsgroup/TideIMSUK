import { defineStorage } from '@aws-amplify/backend';

/**
 * Checklist item photo evidence (Jobs & Checklists module). Keyed
 * `checklist-photos/{checklistInstanceId}/{itemId}/{filename}` by the
 * uploading client — any authenticated user may read/write, matching the
 * existing pattern of Incident logging being open to all roles.
 */
export const storage = defineStorage({
  name: 'tideImsStorage',
  access: (allow) => ({
    'checklist-photos/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'incident-photos/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  }),
});
