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
- `GROQ_API_KEY` is a placeholder (`REPLACE_ME_SET_REAL_GROQ_KEY`) set just
  so the backend would deploy — AI triage-assist/shift-summary will error
  until the real key is set via AWS Console → Amplify → TideIMS → Secret
  management, or `aws ssm put-parameter --name /amplify/shared/d1wx5jes1tad5t/GROQ_API_KEY --type SecureString --value <key> --overwrite`.
- No custom domain — `tideeventsgroup.co.uk` has no Route 53 hosted zone in
  this account yet.
- MFA is optional, not enforced, on the deployed user pool.

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
  four groups (`Admin`, `Controller`, `Loggist`, `Steward`), role surfaced
  through `AuthContext`.
- **Data model** — `amplify/data/resource.ts`: `Event`, `UserProfile`,
  `Incident` (append-only `updates[]`, field-level authorization so only
  Controller/Admin can set `escalationLevel` or `locked`).
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
- **PWA** — manifest, Workbox-generated service worker (`vite-plugin-pwa`),
  and a `localStorage`-backed offline write queue (`src/offline/queue.ts`)
  that queues incident creation while offline and flushes on reconnect.
- **AI, server-side only** (Build Plan Section 11) — two Lambdas, both
  called via custom AppSync queries so the Groq key never reaches the
  browser:
  - `triage-assist` — a "Suggest with AI" button on the New Incident form
    (`TriageSuggest.tsx`) proposes category/zone/level from the narrative.
    It's a suggestion card the Loggist applies or dismisses; nothing is
    ever auto-filled or auto-submitted.
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
- **Photo attachments (S3), push notifications, and the site-map view**
  (Phase 4) are not built yet — `attachmentKeys` exists on the model as a
  landing point.
- **User management (Cognito group assignment) has no UI** — adding
  someone to `Admin`/`Controller`/`Loggist`/`Steward` is still a Cognito
  console/CLI task; it needs an admin-privileged Lambda (`AdminAddUserToGroup`)
  to expose safely through AppSync, which isn't built yet.
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
