import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { triageAssist } from './functions/triage-assist/resource';
import { shiftSummary } from './functions/shift-summary/resource';

defineBackend({
  auth,
  data,
  triageAssist,
  shiftSummary,
});
