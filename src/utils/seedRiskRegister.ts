import { client } from '../data/client';
import type { CategoryKey } from '../constants/taxonomy';
import type { ResidualRating } from '../types/risk';

interface RiskSeedEntry {
  ref: string;
  hazard: string;
  likelihood: number; // 1-5
  consequence: number; // 1-5
  residualRating: ResidualRating;
  controls: string[];
  linkedCategories: CategoryKey[];
}

/**
 * Starting-point risk register from Tide's OSSP hazard register (R01–R14).
 * Ratings/controls are reasonable defaults, not a substitute for the real
 * OSSP risk assessment — review and adjust per event before relying on
 * them. R08 (person entering the water) isn't explicitly numbered in the
 * source material available here; inferred from OSSP Section 3.4.
 */
export const RISK_SEED_DATA: RiskSeedEntry[] = [
  {
    ref: 'R01',
    hazard: 'Vehicle/pedestrian conflict on quayside',
    likelihood: 3,
    consequence: 4,
    residualRating: 'Medium',
    controls: ['Marshalled vehicle access points', 'Pedestrian/vehicle segregation barriers', 'Banksman on active loading'],
    linkedCategories: ['VehicleTraffic'],
  },
  {
    ref: 'R02',
    hazard: 'Crowd density / overcrowding (zone-specific)',
    likelihood: 3,
    consequence: 4,
    residualRating: 'Medium',
    controls: ['Zone capacity monitoring', 'Entry-restriction triggers at 85%/100%', 'Steward crowd counts each hour'],
    linkedCategories: ['CrowdMgmt'],
  },
  {
    ref: 'R03',
    hazard: 'Blocked or reduced emergency egress',
    likelihood: 2,
    consequence: 5,
    residualRating: 'High',
    controls: ['Egress route checks each session', 'No-stacking policy at exits', 'Signage and lighting maintained'],
    linkedCategories: ['CrowdMgmt', 'FireEvac'],
  },
  {
    ref: 'R04',
    hazard: 'Medical emergency — cardiac/serious injury',
    likelihood: 2,
    consequence: 5,
    residualRating: 'High',
    controls: ['Medical provider on site per event medical plan', 'Defibrillator locations known to stewards', 'Clear ambulance access route'],
    linkedCategories: ['Medical'],
  },
  {
    ref: 'R05',
    hazard: 'Alcohol-related disorder / welfare incident',
    likelihood: 3,
    consequence: 3,
    residualRating: 'Medium',
    controls: ['Challenge 25 enforced at bars', 'Welfare tent sign-posted', 'Security patrol licensed areas'],
    linkedCategories: ['Security', 'Welfare', 'Licensing'],
  },
  {
    ref: 'R06',
    hazard: 'Suspicious behaviour / hostile reconnaissance (SCaN)',
    likelihood: 2,
    consequence: 5,
    residualRating: 'High',
    controls: ['Staff SCaN awareness briefing', 'Reporting line to Control known to all stewards', 'CCTV coverage of approach routes'],
    linkedCategories: ['CTSuspicious'],
  },
  {
    ref: 'R07',
    hazard: 'Marquee structural failure or wind-threshold breach',
    likelihood: 2,
    consequence: 5,
    residualRating: 'High',
    controls: ['Daily structural sign-off (see Checklists)', 'Wind speed monitored against certified threshold', 'Evacuation plan for structure failure'],
    linkedCategories: ['FireEvac', 'Weather'],
  },
  {
    ref: 'R08',
    hazard: 'Person entering the water (harbour-specific)',
    likelihood: 2,
    consequence: 5,
    residualRating: 'High',
    controls: ['Harbourside barriers/signage', 'Throw lines at key points', 'HM Coastguard liaison confirmed'],
    linkedCategories: ['HarbourWaterSafety'],
  },
  {
    ref: 'R09',
    hazard: 'Fire — marquee/catering/electrical',
    likelihood: 2,
    consequence: 5,
    residualRating: 'High',
    controls: ['Fire safety sign-off (see Checklists)', 'Extinguishers at catering units', 'Fire marshal briefed per zone'],
    linkedCategories: ['FireEvac'],
  },
  {
    ref: 'R10',
    hazard: 'Electrical failure',
    likelihood: 3,
    consequence: 3,
    residualRating: 'Medium',
    controls: ['Electrical certification sign-off (see Checklists)', 'PAT-tested equipment only', 'Generator maintenance schedule'],
    linkedCategories: ['InfrastructureEquip', 'FireEvac'],
  },
  {
    ref: 'R11',
    hazard: 'Slip, trip, fall',
    likelihood: 3,
    consequence: 2,
    residualRating: 'Low',
    controls: ['Ground surface inspected each session', 'Cable runs matted/covered', 'Wet-weather contingency flooring'],
    linkedCategories: ['Welfare'],
  },
  {
    ref: 'R12',
    hazard: 'Severe weather / wind threshold triggered',
    likelihood: 3,
    consequence: 4,
    residualRating: 'Medium',
    controls: ['Live wind monitoring (see Live Board)', 'Pre-agreed abort/evacuation thresholds', 'Weather briefing each shift handover'],
    linkedCategories: ['Weather', 'Fireworks'],
  },
  {
    ref: 'R13',
    hazard: 'Lost or separated child',
    likelihood: 3,
    consequence: 3,
    residualRating: 'Medium',
    controls: ['Welfare point sign-posted as reunification point', 'Wristband ID scheme advertised', 'Steward briefing on lost-child procedure'],
    linkedCategories: ['MissingPerson'],
  },
  {
    ref: 'R14',
    hazard: 'Volunteer/steward incorrect response requiring correction',
    likelihood: 3,
    consequence: 2,
    residualRating: 'Low',
    controls: ['Pre-event briefing for all stewards', 'Radio supervision from Control', 'Debrief and correction logged, not punitive'],
    linkedCategories: ['VolunteerStaff'],
  },
];

/** Idempotent: skips any ref that already exists for this event. Returns the number created. */
export async function seedRiskRegisterForEvent(eventId: string): Promise<number> {
  const { data: existing } = await client.models.Risk.list({ filter: { eventId: { eq: eventId } } });
  const existingRefs = new Set(existing.map((r) => r.ref));

  let created = 0;
  for (const entry of RISK_SEED_DATA) {
    if (existingRefs.has(entry.ref)) continue;
    await client.models.Risk.create({
      eventId,
      ref: entry.ref,
      hazard: entry.hazard,
      likelihood: entry.likelihood,
      consequence: entry.consequence,
      score: entry.likelihood * entry.consequence,
      controls: entry.controls.map((label) => ({ label, checked: false })),
      residualRating: entry.residualRating,
      linkedIncidentIds: [],
      linkedCategories: entry.linkedCategories,
    });
    created += 1;
  }
  return created;
}
