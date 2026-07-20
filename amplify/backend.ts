import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { triageAssist } from './functions/triage-assist/resource';

defineBackend({
  auth,
  data,
  triageAssist,
});
