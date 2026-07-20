import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { triageAssist } from '../functions/triage-assist/resource';
import { shiftSummary } from '../functions/shift-summary/resource';

/**
 * Data model per Build Plan Section 3.
 *
 * Incidents are append-only: the `updates` field is only ever pushed to,
 * never rewritten in place, and `narrative`/`loggedBy`/`timestamp` are
 * immutable once set. This is what makes the log audit-defensible — see
 * Section 5/8: Tide declares incident level, ground staff do not, so
 * escalationLevel is field-level restricted to Controller/Admin.
 */

const IncidentUpdate = a.customType({
  timestamp: a.datetime().required(),
  userId: a.string().required(),
  userName: a.string().required(),
  text: a.string().required(),
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

  Event: a
    .model({
      name: a.string().required(),
      venue: a.string().required(),
      startDate: a.date().required(),
      endDate: a.date().required(),
      zones: a.string().array(),
      incidents: a.hasMany('Incident', 'eventId'),
    })
    .authorization((allow) => [
      allow.groups(['Admin']).to(['create', 'update', 'delete']),
      allow.authenticated().to(['read']),
    ]),

  UserProfile: a
    .model({
      cognitoSub: a.string().required(),
      name: a.string().required(),
      role: a.string().required(),
      agency: a.string(),
    })
    .authorization((allow) => [
      allow.groups(['Admin']).to(['create', 'update', 'delete', 'read']),
      allow.authenticated().to(['read']),
      allow.ownerDefinedIn('cognitoSub').to(['read']),
    ]),

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
      // Only Tide declares incident level (OSSP 5.2) — Controller/Admin only.
      escalationLevel: a
        .ref('EscalationLevel')
        .required()
        .authorization((allow) => [allow.groups(['Controller', 'Admin']).to(['update'])]),
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
      // Level 4 locks the incident to Controller/Admin only (OSSP command handover).
      // NOTE: this only field-restricts writes to `locked` itself. Enforcing the lock
      // across every other field (status, updates[], etc.) needs a custom resolver —
      // the frontend enforces it client-side for now (see IncidentDetail.tsx); a
      // Lambda authorizer/resolver is the follow-up for full server-side enforcement.
      locked: a
        .boolean()
        .default(false)
        .authorization((allow) => [allow.groups(['Controller', 'Admin']).to(['update'])]),
      resolvedAt: a.datetime(),
    })
    .authorization((allow) => [
      // escalationLevel and locked are field-level restricted to Controller/Admin above;
      // all roles may otherwise create/read/update (append updates[], change status).
      allow.groups(['Admin', 'Controller', 'Loggist', 'Steward']).to(['create', 'read', 'update']),
      allow.authenticated().to(['read']),
    ]),

  IncidentUpdate,

  // Server-side only: browser never calls Groq directly (Section 11).
  triageAssist: a
    .query()
    .arguments({ narrative: a.string().required() })
    .returns(
      a.customType({
        suggestedCategory: a.string(),
        suggestedZone: a.string(),
        suggestedLevel: a.string(),
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
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
