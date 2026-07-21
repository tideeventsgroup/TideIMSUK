import { defineBackend } from '@aws-amplify/backend';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { triageAssist } from './functions/triage-assist/resource';
import { shiftSummary } from './functions/shift-summary/resource';
import { checklistGenerator } from './functions/checklist-generator/resource';
import { sendEscalationPush } from './functions/send-escalation-push/resource';
import { publicEventStatus } from './functions/public-event-status/resource';
import { manageUsers } from './functions/manage-users/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  triageAssist,
  shiftSummary,
  checklistGenerator,
  sendEscalationPush,
  publicEventStatus,
  manageUsers,
});

/**
 * checklist-generator and send-escalation-push talk to DynamoDB directly
 * (not the AppSync/GraphQL client) — both are server-only, no-caller-identity
 * Lambdas, so a direct table grant is simpler than routing through the API.
 * `backend.data.resources.tables` is keyed by model name; `resources.lambda`
 * is publicly typed `IFunction` (no addEnvironment) but is actually the
 * concrete `NodejsFunction`/`Function`, hence the cast.
 */
const tables = backend.data.resources.tables;

const checklistGeneratorLambda = backend.checklistGenerator.resources.lambda as LambdaFunction;
checklistGeneratorLambda.addEnvironment('CHECKLIST_TEMPLATE_TABLE', tables['ChecklistTemplate'].tableName);
checklistGeneratorLambda.addEnvironment('CHECKLIST_INSTANCE_TABLE', tables['ChecklistInstance'].tableName);
checklistGeneratorLambda.addEnvironment('EVENT_TABLE', tables['Event'].tableName);
tables['ChecklistTemplate'].grantReadData(checklistGeneratorLambda);
tables['ChecklistInstance'].grantReadWriteData(checklistGeneratorLambda);
tables['Event'].grantReadData(checklistGeneratorLambda);

const sendEscalationPushLambda = backend.sendEscalationPush.resources.lambda as LambdaFunction;
sendEscalationPushLambda.addEnvironment('PUSH_SUBSCRIPTION_TABLE', tables['PushSubscription'].tableName);
tables['PushSubscription'].grantReadWriteData(sendEscalationPushLambda);

const publicEventStatusLambda = backend.publicEventStatus.resources.lambda as LambdaFunction;
publicEventStatusLambda.addEnvironment('EVENT_TABLE', tables['Event'].tableName);
publicEventStatusLambda.addEnvironment('INCIDENT_TABLE', tables['Incident'].tableName);
tables['Event'].grantReadData(publicEventStatusLambda);
tables['Incident'].grantReadData(publicEventStatusLambda);

// manage-users (src/pages/ManageUsers.tsx) — Cognito admin API access, IAM-scoped
// to this one user pool rather than table grants (it doesn't touch app data).
const manageUsersLambda = backend.manageUsers.resources.lambda as LambdaFunction;
manageUsersLambda.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
manageUsersLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cognito-idp:ListUsers',
      'cognito-idp:AdminListGroupsForUser',
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminRemoveUserFromGroup',
      'cognito-idp:AdminDeleteUser',
    ],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);
