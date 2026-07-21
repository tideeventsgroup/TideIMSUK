import { defineFunction } from '@aws-amplify/backend';

/**
 * Backs the guest-accessible publicEventStatus query (data/resource.ts).
 * Reads Event/Incident tables directly like checklist-generator — no caller
 * identity to route through the API with, and deliberately never returns
 * raw incident data, only a coarse status derived from it.
 */
export const publicEventStatus = defineFunction({
  name: 'public-event-status',
  entry: './handler.ts',
  timeoutSeconds: 10,
  // This function is both a data resolver (query handler below) and a
  // direct table reader (backend.ts grants Event/Incident read access) —
  // pinning it to the data stack avoids a circular dependency between the
  // data and function nested stacks (CloudformationStackCircularDependencyError).
  resourceGroupName: 'data',
});
