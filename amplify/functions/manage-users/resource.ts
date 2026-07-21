import { defineFunction } from '@aws-amplify/backend';

/**
 * Backs the event-control-only user management queries/mutations
 * (data/resource.ts: listAppUsers/createAppUser/updateAppUserRole/
 * deleteAppUser). Talks to Cognito admin APIs directly — creating,
 * grouping, and deleting user pool users isn't something the AppSync
 * data API can do, so this is IAM-scoped to this one user pool
 * (see backend.ts) rather than routed through Amplify Data auth.
 * Pinned to the data stack (like public-event-status) since it's a data
 * resolver — avoids the data/function nested-stack circular dependency.
 */
export const manageUsers = defineFunction({
  name: 'manage-users',
  entry: './handler.ts',
  timeoutSeconds: 15,
  resourceGroupName: 'data',
});
