import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { triageAssist } from '../functions/triage-assist/resource';
import { shiftSummary } from '../functions/shift-summary/resource';
import { sendEscalationPush } from '../functions/send-escalation-push/resource';

/**
 * Data model per Build Plan Section 3.
 *
 * Incidents are append-only: the `updates` field is only ever pushed to,
 * never rewritten in place, and `narrative`/`loggedBy`/`timestamp` are
 * immutable once set. This is what makes the log audit-defensible — see
 * Section 5/8: Tide declares incident level, ground staff do not, so
 * escalationLevel is field-level restricted to Event Control/FMIC.
 */

const IncidentUpdate = a.customType({
  timestamp: a.datetime().required(),
  userId: a.string().required(),
  userName: a.string().required(),
  text: a.string().required(),
});

const RiskControl = a.customType({
  label: a.string().required(),
  checked: a.boolean().required(),
});

const schema = a.schema({
  // Matches CategoryKey in src/constants/taxonomy.ts (Section 9 — supersedes
  // the shorter Section 3 sketch list with the full hazard-register taxonomy).
  Category: a.enum([
    'CrowdMgmt',
    'Medical',
    'Welfare',
    'Security',
    'MissingPerson',
    'FireEvac',
    'Weather',
    'Fireworks',
    'VehicleTraffic',
    'CTSuspicious',
    'InfrastructureEquip',
    'HarbourWaterSafety',
    'Licensing',
    'VolunteerStaff',
    'LostProperty',
    'Other',
  ]),

  Zone: a.enum(['ZoneA', 'ZoneB', 'ZoneC', 'ZoneD', 'Harbourside', 'AccessEgress', 'WholeSite']),

  IncidentStatus: a.enum(['Open', 'InProgress', 'Resolved', 'EscalatedMajor']),

  Priority: a.enum(['Standard', 'Major']),

  EscalationLevel: a.enum(['Level1', 'Level2', 'Level3', 'Level4']),

  ResidualRating: a.enum(['Low', 'Medium', 'High', 'Critical']),

  // OSSP hazard register R01–R14 (WeTrack-style risk register). Risks are
  // per-event (like Incident) so residual ratings/controls can be tailored
  // to a specific site, while `ref` + `hazard` are seeded from the same
  // standard OSSP template each time (see src/utils/seedRiskRegister.ts).
  Risk: a
    .model({
      eventId: a.id().required(),
      event: a.belongsTo('Event', 'eventId'),
      ref: a.string().required(), // e.g. "R01"
      hazard: a.string().required(),
      likelihood: a.integer().required(), // 1-5
      consequence: a.integer().required(), // 1-5
      score: a.integer().required(), // likelihood * consequence, client-computed
      controls: a.ref('RiskControl').array(),
      residualRating: a.ref('ResidualRating').required(),
      linkedIncidentIds: a.string().array(),
      // Category keys (src/constants/taxonomy.ts) this risk auto-suggests
      // against on incident creation.
      linkedCategories: a.string().array(),
    })
    .authorization((allow) => [
      allow.groups(['event-control']).to(['create', 'update', 'delete']),
      allow.authenticated().to(['read']),
    ]),

  RiskControl,

  Event: a
    .model({
      name: a.string().required(),
      venue: a.string().required(),
      startDate: a.date().required(),
      endDate: a.date().required(),
      zones: a.string().array(),
      incidents: a.hasMany('Incident', 'eventId'),
      risks: a.hasMany('Risk', 'eventId'),
      checklistInstances: a.hasMany('ChecklistInstance', 'eventId'),
    })
    .authorization((allow) => [
      allow.groups(['event-control']).to(['create', 'update', 'delete']),
      allow.authenticated().to(['read']),
    ]),

  StaffStatus: a.enum(['OnPost', 'Break', 'OffDuty']),

  UserProfile: a
    .model({
      cognitoSub: a.string().required(),
      name: a.string().required(),
      role: a.string().required(),
      agency: a.string(),
      // Staff role-scoped views (WeTrack-inspired): a Staff device only sees
      // incidents in their assigned zone. Self-service (set via a control
      // in the header), client-side filter only — see LiveBoard.tsx
      // caveat, same limitation as the Level 4 lock.
      assignedZone: a.string(),
      // Self-reported shift presence, shown on the FMIC ground roster
      // (FMICGround.tsx). Not authoritative — a steward could forget to
      // toggle it — same "trust the reporter" limitation as everything
      // else self-service in this app.
      status: a.ref('StaffStatus'),
      statusUpdatedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.groups(['event-control']).to(['create', 'update', 'delete', 'read']),
      // FMIC needs write access to redeploy a steward to a different zone
      // from the ground roster (FMICGround.tsx) — read/update only, not
      // create/delete, since profile creation stays event-control/self-service.
      allow.groups(['fmic']).to(['read', 'update']),
      allow.authenticated().to(['read']),
      allow.ownerDefinedIn('cognitoSub').to(['read', 'create', 'update']),
    ]),

  // Web Push subscriptions (Event Control enhancement) — one per
  // device/browser a user has enabled notifications on. `userId` (cognitoSub)
  // lets sendEscalationPush target a single person's devices (e.g. a
  // redeploy notice) instead of always fanning out to everyone.
  PushSubscription: a
    .model({
      endpoint: a.string().required(),
      p256dh: a.string().required(),
      auth: a.string().required(),
      userId: a.string(),
    })
    .authorization((allow) => [allow.owner()]),

  Incident: a
    .model({
      eventId: a.id().required(),
      event: a.belongsTo('Event', 'eventId'),
      // Server-set on write via custom resolver-side default; client should not override.
      timestamp: a.datetime().required(),
      category: a.ref('Category').required(),
      subcategory: a.string(),
      zone: a.ref('Zone').required(),
      // No schema-level default on ref'd enums — client always sets these explicitly
      // (status: 'Open', priority: 'Standard', escalationLevel: 'Level1' on create).
      status: a.ref('IncidentStatus').required(),
      priority: a.ref('Priority').required(),
      // Only Tide declares incident level (OSSP 5.2) — event-control any
      // level, fmic Level 1-2 only (client-enforced via canDeclareLevel,
      // same limitation as the Level 4 lock below — field auth can't
      // restrict by enum *value*, only by field name), staff not at all
      // after creation. Field-level auth on a required field overrides the
      // model-level default for that field entirely (not just adds to it),
      // so create/read must both be re-granted explicitly alongside the
      // update restriction — every role that can create an incident sets
      // escalationLevel: 'Level1' as part of that create call.
      // IMPORTANT: a group must appear in exactly one rule per field here —
      // listing a group in both a broad create/read rule and a separate
      // update-only rule (rather than one combined rule) makes Amplify's
      // per-field auth codegen drop that group's create grant entirely
      // (confirmed live: a group got "Unauthorized on [escalationLevel,
      // locked]" on create while groups that only ever appear in one rule
      // worked fine).
      escalationLevel: a
        .ref('EscalationLevel')
        .required()
        .authorization((allow) => [
          allow.groups(['event-control', 'fmic']).to(['create', 'read', 'update']),
          allow.groups(['staff']).to(['create', 'read']),
          allow.authenticated().to(['read']),
        ]),
      loggedByUserId: a.string().required(),
      loggedByName: a.string().required(),
      loggedByRole: a.string().required(),
      assignedAgency: a.string(),
      narrative: a.string().required(),
      radioChannel: a.integer(),
      lat: a.float(),
      lng: a.float(),
      updates: a.ref('IncidentUpdate').array(),
      attachmentKeys: a.string().array(),
      // Risk register tagging (WeTrack-inspired) — optional, any role may tag.
      linkedRiskIds: a.string().array(),
      // Extra detail, all optional — kept off the primary capture flow
      // (NewIncident.tsx's "Add detail" section), same narrative-first
      // philosophy as the rest of the form.
      locationDetail: a.string(),
      personsInvolved: a.string(),
      witnesses: a.string(),
      injuredCount: a.integer(),
      reporterCallsign: a.string(),
      // Level 4 locks the incident to event-control only (OSSP command handover,
      // event-control is the only role that ever declares Level 4).
      // NOTE: this only field-restricts writes to `locked` itself. Enforcing the lock
      // across every other field (status, updates[], etc.) needs a custom resolver —
      // the frontend enforces it client-side for now (see IncidentDetail.tsx); a
      // Lambda authorizer/resolver is the follow-up for full server-side enforcement.
      // Every role that can create an incident sets `locked: false` on create
      // (NewIncident.tsx), so create/read need to be granted broadly too —
      // only the later *change* to true is event-control-only. See the
      // note on escalationLevel above re: one rule per group per field.
      locked: a
        .boolean()
        .default(false)
        .authorization((allow) => [
          allow.groups(['event-control']).to(['create', 'read', 'update']),
          allow.groups(['fmic', 'staff']).to(['create', 'read']),
          allow.authenticated().to(['read']),
        ]),
      resolvedAt: a.datetime(),
    })
    .authorization((allow) => [
      // escalationLevel and locked are field-level restricted above;
      // all roles may otherwise create/read/update (append updates[], change status).
      allow.groups(['event-control', 'fmic', 'staff']).to(['create', 'read', 'update']),
      allow.authenticated().to(['read']),
    ]),

  IncidentUpdate,

  ChecklistItemStatus: a.enum(['Pending', 'Done']),

  // Template definition — global/reusable across events, not eventId-scoped.
  ChecklistTemplateItem: a.customType({
    label: a.string().required(),
    requiresPhoto: a.boolean().required(),
    requiresSignoff: a.boolean().required(),
  }),

  // Instance item — same shape as the template item plus completion state.
  // Completion is append-only in spirit (same discipline as Incident.updates[]):
  // the client rewrites the array on each mutation (a DynamoDB/AppSync list-field
  // constraint, not a choice), but never edits a previously Done item backward —
  // only status/completedBy/completedAt/photoS3Key move forward.
  ChecklistInstanceItem: a.customType({
    label: a.string().required(),
    requiresPhoto: a.boolean().required(),
    requiresSignoff: a.boolean().required(),
    status: a.ref('ChecklistItemStatus').required(),
    completedBy: a.string(),
    completedAt: a.datetime(),
    photoS3Key: a.string(),
    notes: a.string(),
  }),

  // Reusable template (Jobs & Checklists module) — seeded from OSSP §18-19
  // (structural/electrical/fire/gas sign-off) via src/utils/seedChecklists.ts.
  // `recurring: true` templates get a fresh ChecklistInstance generated daily
  // per active event by the checklist-generator scheduled function.
  ChecklistTemplate: a
    .model({
      name: a.string().required(),
      recurring: a.boolean().required(),
      items: a.ref('ChecklistTemplateItem').array().required(),
    })
    .authorization((allow) => [
      allow.groups(['event-control']).to(['create', 'update', 'delete']),
      allow.authenticated().to(['read']),
    ]),

  // A dated checklist run. `templateId` is null for ad-hoc jobs, including
  // ones created via the Incident → Job conversion button (sourceIncidentId
  // back-reference).
  ChecklistInstance: a
    .model({
      eventId: a.id().required(),
      event: a.belongsTo('Event', 'eventId'),
      templateId: a.id(),
      title: a.string().required(),
      date: a.date().required(),
      assignee: a.string(),
      dueAt: a.datetime(),
      sourceIncidentId: a.id(),
      items: a.ref('ChecklistInstanceItem').array().required(),
    })
    // Staff explicitly excluded — checklists are an event-control/FMIC tool,
    // not part of the deliberately minimal Staff PWA (Incidents + Messaging only).
    .authorization((allow) => [
      allow.groups(['event-control', 'fmic']).to(['create', 'read', 'update']),
      allow.authenticated().to(['read']),
    ]),

  // Server-side only: browser never calls Groq directly (Section 11).
  triageAssist: a
    .query()
    .arguments({
      narrative: a.string().required(),
      // JSON-stringified [{ref, hazard}] for the active event's risk register,
      // so suggestions can cite real refs instead of guessing.
      riskContext: a.string(),
    })
    .returns(
      a.customType({
        suggestedCategory: a.string(),
        suggestedSubcategory: a.string(),
        suggestedZone: a.string(),
        suggestedLevel: a.string(),
        suggestedPriority: a.string(),
        suggestedRadioChannel: a.integer(),
        suggestedAssignedAgency: a.string(),
        suggestedRiskRefs: a.string().array(),
        narrativeSummary: a.string(),
        rationale: a.string(),
      }),
    )
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(triageAssist)),

  // Server-side only: drafts the shift handover summary from structured
  // incident counts (Build Plan Section 11). Never declares/escalates/resolves.
  shiftSummary: a
    .query()
    .arguments({ summaryJson: a.string().required() })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(shiftSummary)),

  // Fans out a Web Push notification to every stored subscription. Called
  // from every incident-logging action (new incident, status change,
  // update added, escalation declared) — see src/utils/pushNotify.ts and
  // its call sites. `urgent` maps to Notification.requireInteraction in
  // the service worker (src/sw.ts) — only Level 3/4 escalations use it, so
  // routine logging doesn't sit pinned on screen until dismissed. `alarm`
  // (Level 4 declarations only) additionally tells any open app tab to
  // sound an audible siren via postMessage — see src/sw.ts and
  // src/components/AlarmListener.tsx. It has no effect if the app isn't
  // open in a tab; the OS/browser's default notification sound is the
  // only audible alert when the app is fully closed.
  sendEscalationPush: a
    .mutation()
    .arguments({
      title: a.string().required(),
      body: a.string().required(),
      url: a.string(),
      urgent: a.boolean(),
      alarm: a.boolean(),
      // Omit to broadcast to every subscribed device (incident-logging
      // path); set to a cognitoSub to reach only that person's devices
      // (e.g. FMICGround.tsx's redeploy notice).
      targetUserId: a.string(),
    })
    .returns(a.integer())
    .authorization((allow) => [allow.groups(['event-control', 'fmic', 'staff'])])
    .handler(a.handler.function(sendEscalationPush)),

  MessageChannel: a.enum(['OPS', 'SECURITY', 'STEWARDS', 'MEDICAL']),

  // Text-based backup to the DMR radio plan (Event Control enhancement) —
  // channels mirror the radio channels for familiarity. OPS is broadcast:
  // event-control/fmic post, everyone reads; the other three channels are
  // open to staff as well. Enforcing "staff can't post to OPS" needs a
  // value-conditional check a model/field-level rule can't express (auth
  // rules restrict by field name, not by the enum value written to it), so
  // that's client-side only for now (src/pages/Messages.tsx) — same
  // documented limitation as the Level 4 lock and Staff zone-scoping.
  Message: a
    .model({
      channel: a.ref('MessageChannel').required(),
      text: a.string().required(),
      senderId: a.string().required(),
      senderName: a.string().required(),
      senderRole: a.string().required(),
    })
    .authorization((allow) => [
      allow.groups(['event-control', 'fmic', 'staff']).to(['create', 'read']),
    ]),

  // FMIC ground ops (src/pages/FMICGround.tsx) — append-only logs, never
  // updated/deleted, so the history itself is the post-event review record.
  // Command-role tools only: staff don't read these back.

  // One row per redeploy. `fromZone` is the zone the steward was in before
  // this move (may be null if they had none set yet).
  ZoneReassignment: a
    .model({
      eventId: a.id().required(),
      userId: a.string().required(),
      userName: a.string().required(),
      fromZone: a.string(),
      toZone: a.string().required(),
      reassignedByUserId: a.string().required(),
      reassignedByName: a.string().required(),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [allow.groups(['event-control', 'fmic']).to(['create', 'read'])]),

  // Roll-call log (Section 15.1) — one row per confirm/reset tap. The
  // current state of a zone is the most recent row for that zone+event,
  // computed client-side; older rows stay as the audit trail.
  ZoneClearance: a
    .model({
      eventId: a.id().required(),
      zone: a.string().required(),
      cleared: a.boolean().required(),
      confirmedByUserId: a.string().required(),
      confirmedByName: a.string().required(),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [allow.groups(['event-control', 'fmic']).to(['create', 'read'])]),

  // Structured shift handover between the two FMICs (Section 5.1: day-to-day
  // allocation "confirmed at the daily briefing and logged").
  ShiftHandoverNote: a
    .model({
      eventId: a.id().required(),
      openItems: a.string(),
      watchItems: a.string(),
      whereaboutsNote: a.string(),
      authoredByUserId: a.string().required(),
      authoredByName: a.string().required(),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [allow.groups(['event-control', 'fmic']).to(['create', 'read'])]),

  // Post-incident debrief / RCA (ICS/NIMS-style accountability record), one
  // per resolved Level 3/4 incident — see IncidentDetail.tsx. Append-only:
  // once authored, a debrief is never edited, matching the other ground-ops
  // audit logs above.
  IncidentDebrief: a
    .model({
      incidentId: a.id().required(),
      eventId: a.id().required(),
      whatHappened: a.string().required(),
      whatWorkedWell: a.string(),
      whatToChange: a.string(),
      authoredByUserId: a.string().required(),
      authoredByName: a.string().required(),
      timestamp: a.datetime().required(),
    })
    .authorization((allow) => [allow.groups(['event-control', 'fmic']).to(['create', 'read'])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
