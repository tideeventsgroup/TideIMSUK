import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { triageAssist } from './functions/triage-assist/resource';
import { shiftSummary } from './functions/shift-summary/resource';
import { checklistGenerator } from './functions/checklist-generator/resource';
import { sendEscalationPush } from './functions/send-escalation-push/resource';

defineBackend({
  auth,
  data,
  storage,
  triageAssist,
  shiftSummary,
  checklistGenerator,
  sendEscalationPush,
});
