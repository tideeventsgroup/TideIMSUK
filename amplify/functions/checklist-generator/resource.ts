import { defineFunction } from '@aws-amplify/backend';

/**
 * Daily job: for every recurring ChecklistTemplate and every Event whose
 * date range covers today, ensure a ChecklistInstance exists for today —
 * skips creation if one's already there (idempotent, safe to re-run).
 */
export const checklistGenerator = defineFunction({
  name: 'checklist-generator',
  entry: './handler.ts',
  schedule: 'every day',
  timeoutSeconds: 60,
  // Grouped with the data stack (not its own nested stack) — it's granted
  // direct DynamoDB table access in backend.ts, which would otherwise create
  // a circular dependency between the function and data nested stacks.
  resourceGroupName: 'data',
});
