# Tide IMS

Incident Management System for Tide's event control room — a real-time,
append-only incident log built as an installable PWA on AWS Amplify Gen 2.
Domain target: `ims.tideeventsgroup.co.uk`.

## Live deployment

**https://main.d1wx5jes1tad5t.amplifyapp.com/** — Amplify app `d1wx5jes1tad5t`,
branch `main`, region `eu-west-2`, account `589389426290` (a shared agency
AWS account — this app doesn't touch the account's other projects).
Deployed manually (`ampx pipeline-deploy` + a manual Hosting upload, not
git-connected — see "Redeploying" below), since connecting Amplify Hosting
to GitHub requires a token that wasn't available at deploy time.

`amplify_outputs.json` in this repo is the **real config for that live
backend** (Cognito user pool, AppSync API — these are client-safe
identifiers, not secrets, and already ship inside the built JS bundle).
Running `npm run dev` locally connects to that same live backend unless you
run your own `npx ampx sandbox`.

**Known gaps on the live deployment:**
- No custom domain — `tideeventsgroup.co.uk` has no Route 53 hosted zone in
  this account yet.
- MFA is optional, not enforced, on the deployed user pool.
- `GROQ_API_KEY` and `VAPID_PRIVATE_KEY` are both set as real secrets
  (`aws ssm put-parameter --name /amplify/shared/d1wx5jes1tad5t/<name> --type SecureString --value <value> --overwrite` —
  Amplify Gen2's `secret()` helper doesn't support setting a deployed-branch
  secret any other way outside the Console). Rotate either via AWS Console →
  Amplify → TideIMS → Secret management, or the same command with
  `--overwrite`.
- The Risk register and default checklist templates need seeding once per
  event — sign in as Controller/Admin and use the "Seed R01–R14" button on
  `/risk-register` and "Seed default templates" on `/checklists`. Nothing
  seeds automatically on deploy.

**Redeploying after further changes** (no GitHub auto-deploy is wired up):
```bash
export CI=true   # ampx pipeline-deploy refuses to run without this
npx ampx pipeline-deploy --branch main --app-id d1wx5jes1tad5t   # backend
npm run build
cd dist && zip -r /tmp/dist.zip . && cd ..
aws amplify create-deployment --app-id d1wx5jes1tad5t --branch-name main   # returns jobId + zipUploadUrl
curl -X PUT -T /tmp/dist.zip "<zipUploadUrl>"
aws amplify start-deployment --app-id d1wx5jes1tad5t --branch-name main --job-id <jobId>
```

## About this repo

The full data model, auth, live board, incident logging/detail views, CSV/PDF
reporting, PWA shell with an offline write queue, and server-side AI
Lambdas are all implemented and now running against the live backend above.

## What's implemented

- **Auth** — Cognito user pool via `@aws-amplify/ui-react`'s `Authenticator`,
  five groups (`Admin`, `Controller`, `Loggist`, `Steward`, `Medical` — the
  last is a discipline-scoped viewer role, see role-scoped views below),
  role surfaced through `AuthContext`.
- **Data model** — `amplify/data/resource.ts`: `Event`, `UserProfile`,
  `Incident` (append-only `updates[]`, field-level authorization so only
  Controller/Admin can set `escalationLevel` or `locked`), `Risk`,
  `ChecklistTemplate`, `ChecklistInstance`, `PushSubscription`.
- **Risk register** (`/risk-register`, Controller/Admin) — a
  Controller/Admin-managed hazard register seeded from Tide's OSSP hazard
  register (R01–R14, `src/utils/seedRiskRegister.ts` — review ratings/
  controls against the real document before relying on them live), with a
  per-hazard checklist of controls (not free text), an incidents-per-ref
  chart, and incident-to-risk linking. New Incident auto-suggests risk refs
  matching the selected category; the AI triage assistant can also suggest
  refs from the narrative (see below). CSV/PDF exports carry a risk-ref
  column.
- **Jobs & Checklists** (`/checklists`) — `ChecklistTemplate` +
  `ChecklistInstance`, with a scheduled Lambda
  (`amplify/functions/checklist-generator`, runs daily) auto-creating
  today's instance for every recurring template on every currently-active
  event. Default templates seeded from OSSP §18–19 (structural/electrical/
  fire/gas sign-off). Items support inline camera capture (uploaded to S3
  under `checklist-photos/`) and required sign-off. Any Incident can be
  converted to an ad-hoc job via "Convert to job" on Incident Detail —
  creates a `ChecklistInstance` with a `sourceIncidentId` back-reference.
- **Role-scoped Live Board views (client-side only)** — Steward sees only
  incidents in their self-assigned zone (`MyZoneSelector.tsx`, self-service
  since there's no admin user-management UI — see gaps below) plus
  whole-site incidents; Medical sees only `category: Medical` incidents;
  Controller/Admin/Loggist see everything. This is a UX scope, not a
  security boundary — AppSync authorization doesn't yet enforce row-level
  visibility, so it needs a custom resolver to be a real guarantee.
- **Web Push escalation alerts** — declaring Level 3/4 on an incident fans
  out a push notification to every subscribed device
  (`amplify/functions/send-escalation-push`, triggered by a custom
  mutation from `IncidentDetail.tsx`, not a DynamoDB stream). Devices opt
  in via the bell icon in the header (`PushSubscribeToggle.tsx`); the
  service worker (`src/sw.ts`, `vite-plugin-pwa` in `injectManifest` mode)
  handles the `push`/`notificationclick` events and deep-links to the
  incident.
- **Live board** — `AppSync` subscriptions (`onCreate`/`onUpdate`), sorted
  by escalation level, Level 4 banner across all devices.
- **Incident logging** — full Section 9 category/subcategory taxonomy,
  GPS capture with zone reverse-lookup (point-in-polygon — zone polygons
  are placeholders, see below), radio channel suggestion.
- **Escalation** — OSSP Section 5.2 levels enforced both in the UI and at
  the schema's field-authorization level: incidents are created at Level 1;
  only Controller/Admin can declare Level 2–4 or lock a Level 4 incident.
- **Reporting** — CSV and branded PDF export (`src/utils/pdf.ts`, jsPDF —
  generated entirely client-side, no server round-trip, works offline once
  cached), covering three report types: a single incident report (from
  Incident Detail), the full incident log (from the Live Board), and the
  shift handover/debrief report (from Reports — includes the AI summary if
  already generated, plus a "Reviewed by / Date" sign-off line).
- **PWA** — manifest, a hand-written service worker (`src/sw.ts`,
  `vite-plugin-pwa` in `injectManifest` mode — needed for the push/
  notificationclick handlers above), and a `localStorage`-backed offline
  write queue (`src/offline/queue.ts`) that queues incident creation while
  offline and flushes on reconnect. Layout is responsive down to phone
  widths — the header nav collapses to icon-only, the Live Board's radio/
  wind side panel moves below the incident list, and multi-field form rows
  wrap/stack instead of overflowing.
- **AI, server-side only** (Build Plan Section 11) — two Lambdas, both
  called via custom AppSync queries so the Groq key never reaches the
  browser:
  - `triage-assist` — "Fill form with AI" on the New Incident form
    (`TriageSuggest.tsx`) drafts category, subcategory, zone, priority,
    radio channel, assigned agency, linked risk refs, and a cleaned-up
    narrative from a rough free-text description (including matching
    against the active event's own risk register, passed as context). It's
    a draft card the Loggist reviews and applies in one step, or dismisses
    — nothing is ever auto-filled or auto-submitted, and it never touches
    escalation level.
  - `shift-summary` — a "Generate" button on Reports (`AiSummaryPanel.tsx`)
    drafts a plain-English handover paragraph from the structured incident
    counts. Labeled as a draft to review, not a decision — matches the
    OSSP boundary that AI drafts/flags and a human with command authority
    decides.
- **Event setup** — `/setup` (Admin-only): create/edit Events and pick
  which one is "active" (`EventContext.tsx`, persisted to `localStorage`
  per device). Replaces having to hand-write a GraphQL mutation in the
  AppSync console just to get the app usable. Every other page reads the
  active event and shows a plain "no event configured" state — with a
  link to Setup for Admins — until one exists.
- **Design system** — token-based light "office" and dark "ops console"
  themes (`src/styles/tokens.css`), a theme toggle that persists to
  `localStorage`, and a `SeverityBadge` that's always icon+text+color (never
  color-only) so Level 1–4 reads correctly under daylight glare and for
  colorblind users. Declaring Level 3/4 requires an explicit confirm dialog.
- **Brand** — real Tide Events Group Scotland logo (shield mark + wordmark,
  theme-aware swap between the black-text and white-text exports) used for
  the header lockup, favicon, and PWA icons; brand orange (`#F05524`,
  sampled from the logo) reserved for primary actions/focus rings and kept
  deliberately distinct from the severity color scale.
- **Live board search/filter + KPI strip** — free-text search plus
  category/zone/status/level filters, and an at-a-glance Open/In
  Progress/Active L3-L4 stat strip.
- **Wind conditions panel** — live wind speed/gust/direction for
  Stranraer via Open-Meteo (no API key needed), with a caution/action
  threshold indicator tied directly to the OSSP's wind-threshold incident
  categories (marquee wind-threshold breach, fireworks wind-abort decision).
  The thresholds in `WindConditionsPanel.tsx` are placeholders — replace
  with your structural engineer's and fireworks contractor's certified
  figures before relying on this for a go/no-go call.

## Known scaffold gaps (by design, flagged rather than hidden)

- **Zone polygons are empty** (`src/constants/zones.ts`) — trace them from
  the Official Site Plan 2026 before relying on GPS auto zone-suggestion;
  the app falls back to manual selection until then.
- **The Level 4 lock is enforced client-side only.** The schema
  field-restricts `locked`/`escalationLevel` writes to Controller/Admin,
  but locking every *other* field (status, `updates[]`) once `locked` is
  true needs a custom AppSync resolver — see the comment in
  `amplify/data/resource.ts`.
- **The site-map view** (Phase 4) is not built yet. Photo attachments (S3)
  and push notifications now are — see Risk register/Jobs & Checklists/Web
  Push above.
- **User management (Cognito group assignment) has no UI** — adding
  someone to `Admin`/`Controller`/`Loggist`/`Steward`/`Medical` is still a
  Cognito console/CLI task; it needs an admin-privileged Lambda
  (`AdminAddUserToGroup`) to expose safely through AppSync, which isn't
  built yet. Steward zone assignment is the one exception — it's
  self-service (`MyZoneSelector.tsx`) since it's just a `UserProfile` field
  a Steward owns, not a group membership change.
- **`checklist-generator` and `send-escalation-push` read/write DynamoDB
  directly** (`@aws-sdk/lib-dynamodb`, granted via
  `backend.data.resources.tables` + `grantReadWriteData` in `backend.ts`)
  rather than going through the AppSync/GraphQL client — the
  `getAmplifyDataClientConfig` + `$amplify/env` pattern that Amplify's own
  docs show for this doesn't currently bundle under `ampx pipeline-deploy`
  with this toolchain version (fails with `Could not resolve
  "$amplify/env/<fn>"` at esbuild time, despite working fine under `ampx
  sandbox`). Both functions are server-only with no caller identity, so a
  direct table grant is a reasonable substitute, not just a workaround —
  but it does mean these two bypass the schema's field/model-level
  authorization rules entirely (acceptable here: neither writes anything a
  client couldn't already write through the API with the right role).
- **SMS incident intake and multi-event/Hub portfolio rollup** are
  explicitly out of scope for now — deferred until there's a concrete
  need (SMS needs a Twilio/AWS End User Messaging integration decision;
  Hub rollup only matters once Tide runs concurrent events).
- **No automated tests.**
- **jsPDF adds real weight to the main bundle** (~140KB gzip) since it's
  statically imported by three pages rather than route-split — acceptable
  for a PWA that's installed and cached, but worth lazy-loading
  (`import('../utils/pdf')`) if initial load time becomes a concern.

## Connecting your own AWS sandbox (optional, for local dev against your own backend instead of the shared live one)

1. Configure AWS credentials for the account/region you want to deploy
   into (`eu-west-2` recommended per the build plan — UK data residency).
2. `npm install` (already done if you're reading this from a fresh clone,
   just run it after cloning).
3. `npx ampx sandbox` — provisions a personal dev backend (Cognito,
   AppSync, DynamoDB) and overwrites the placeholder `amplify_outputs.json`
   with real values. Leave it running while you develop; it hot-reloads
   backend changes.
4. Set the Groq key — shared by both AI Lambdas (`triage-assist` and
   `shift-summary`): `npx ampx sandbox secret set GROQ_API_KEY` (paste the
   key when prompted — rotate the key first if it's ever touched a `.env`
   file or client code).
5. `npm run dev` — the frontend picks up `amplify_outputs.json`
   automatically.
6. Create your first users in the Cognito console (or via `ampx sandbox`
   output) and add them to the `Admin`/`Controller`/`Loggist`/`Steward`
   groups as appropriate.
7. Sign in as an Admin and go to **Setup** (`/setup`) to create your first
   Event — no more manual GraphQL mutations needed.

## Deploying to `ims.tideeventsgroup.co.uk`

1. Push this repo to a Git provider Amplify Hosting can read from.
2. In the Amplify Console, create an app from the repo — Gen 2 apps detect
   `amplify/backend.ts` automatically and deploy both frontend and backend
   per branch.
3. Set the `GROQ_API_KEY` secret for the deployed branch environment
   (Amplify Console → Secrets, or `ampx pipeline-deploy` with secrets
   configured) — not as a plaintext env var. Both `triage-assist` and
   `shift-summary` read it.
4. In Route 53, add `ims.tideeventsgroup.co.uk` as a custom domain against
   the Amplify app; Amplify provisions the ACM certificate.
5. Confirm MFA is enforced for anyone added to `Controller`/`Admin` groups
   in the deployed user pool (optional TOTP is configured in
   `amplify/auth/resource.ts`; tighten to required before go-live if the
   OSSP requires it).

## Local commands

```bash
npm run dev               # local frontend dev server
npm run build              # typecheck + production build (also runs PWA build)
npm run typecheck:amplify  # typecheck the amplify/ backend definition separately
npm run sandbox             # npx ampx sandbox — personal cloud dev backend
npm run lint                # oxlint
```

## Project layout

```
amplify/
  auth/resource.ts        Cognito user pool + groups
  data/resource.ts        GraphQL schema (Event, UserProfile, Incident, AI queries)
  functions/triage-assist/  Groq-backed suggestion Lambda (server-side only)
  functions/shift-summary/  Groq-backed handover-draft Lambda (server-side only)
  backend.ts               Amplify Gen 2 entry point
src/
  styles/tokens.css        design tokens — light/dark theme, severity scale, brand orange
  constants/               taxonomy, zones, escalation levels
  context/AuthContext.tsx  role/group resolution from the Cognito session
  context/ThemeContext.tsx light/dark toggle, persisted to localStorage
  context/EventContext.tsx active-event selection, persisted to localStorage
  data/client.ts           typed AppSync client
  hooks/                   useIncidents (subscriptions), useGeolocation
  offline/queue.ts         offline write queue
  utils/pdf.ts             branded PDF report generation (jsPDF, client-side)
  pages/                   LiveBoard, NewIncident, IncidentDetail, Reports, EventSetup
  components/               IncidentCard, EscalationBanner, SeverityBadge,
                             IncidentFilters, WindConditionsPanel, TriageSuggest,
                             AiSummaryPanel, Logo, etc.
public/brand/              real Tide logo exports (black-text / white-text)
public/icons/, favicon-*.png  generated from the logo's shield mark
```
