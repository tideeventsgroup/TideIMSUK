/**
 * Full incident taxonomy — Build Plan Section 9, sourced from the OSSP
 * hazard register (R01–R14) plus standard event-safety categories.
 * `defaultRadioChannel` matches the 5-channel DMR plan (Ch5 = emergency).
 */

export type CategoryKey =
  | 'CrowdMgmt'
  | 'Medical'
  | 'Welfare'
  | 'Security'
  | 'MissingPerson'
  | 'FireEvac'
  | 'Weather'
  | 'Fireworks'
  | 'VehicleTraffic'
  | 'CTSuspicious'
  | 'InfrastructureEquip'
  | 'HarbourWaterSafety'
  | 'Licensing'
  | 'VolunteerStaff'
  | 'LostProperty'
  | 'Other';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  defaultRadioChannel: number | null;
  subcategories: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'CrowdMgmt',
    label: 'Crowd & Site',
    defaultRadioChannel: 2,
    subcategories: [
      'Crowd density / overcrowding (zone-specific)',
      'Blocked or reduced emergency egress',
      'Crush / crowd surge — stage front or pinch point',
      'Entry-restriction trigger reached (85%/100% cap)',
      'Zone restriction imposed',
    ],
  },
  {
    key: 'Medical',
    label: 'Medical & Welfare',
    defaultRadioChannel: 4,
    subcategories: [
      'Medical emergency — cardiac/serious injury',
      'Minor first aid',
      'Ambulance called / SAS escalation',
      'Mental health crisis / welfare concern',
      'Alcohol-related welfare incident',
      'Suspected spiking',
      'Allergic reaction / food safety',
      'Slip, trip, fall',
      'Person entering the water (harbour-specific)',
    ],
  },
  {
    key: 'Security',
    label: 'Security & Crime',
    defaultRadioChannel: 5,
    subcategories: [
      'Alcohol-related disorder',
      'Assault / physical altercation',
      'Theft',
      'Ejection (last resort per OSSP)',
      'Suspicious behaviour / hostile reconnaissance (SCaN report)',
      'Suspicious item / abandoned bag',
      'Drug-related incident',
      'Weapon sighting',
      'Ticket/QR fraud or unauthorised entry',
    ],
  },
  {
    key: 'MissingPerson',
    label: 'Missing / Vulnerable Persons',
    defaultRadioChannel: 2,
    subcategories: [
      'Lost or separated child',
      'Missing vulnerable adult',
      'PEEP evacuation-assistance request',
    ],
  },
  {
    key: 'FireEvac',
    label: 'Fire & Structural',
    defaultRadioChannel: 5,
    subcategories: [
      'Fire — marquee/catering/electrical',
      'Marquee structural failure or wind-threshold breach',
      'Electrical failure',
      'Gas/LPG issue',
    ],
  },
  {
    key: 'Weather',
    label: 'Weather & Environment',
    defaultRadioChannel: 2,
    subcategories: [
      'Severe weather / wind threshold triggered',
      'Lightning',
      'Extreme heat/cold welfare impact',
    ],
  },
  {
    key: 'Fireworks',
    label: 'Fireworks (Friday-specific)',
    defaultRadioChannel: 3,
    subcategories: ['Wind-abort decision', 'Exclusion zone breach', 'Post-display dud/incident'],
  },
  {
    key: 'VehicleTraffic',
    label: 'Vehicle & Traffic',
    defaultRadioChannel: 1,
    subcategories: [
      'Vehicle/pedestrian conflict on quayside',
      'Unauthorised vehicle access attempt',
      'Traffic incident off-site (approach roads)',
      'Coach/taxi dispersal issue',
    ],
  },
  {
    key: 'CTSuspicious',
    label: "Counter-Terrorism (Martyn's Law)",
    defaultRadioChannel: 5,
    subcategories: [
      'CT — hostile reconnaissance report',
      'CT — suspicious item (cordon procedure)',
      'CT — credible threat, Stage 3/4 response',
      'Evacuation ordered',
      'Invacuation ordered',
      'Lockdown ordered',
      'Drone (UAS) sighting',
    ],
  },
  {
    key: 'InfrastructureEquip',
    label: 'Operations & Infrastructure',
    defaultRadioChannel: 3,
    subcategories: [
      'Radio/comms failure — handset loss/fault',
      'PA/sound system failure',
      'Generator/power failure',
      'Toilet/welfare facility failure',
      'Waste/spillage hazard',
    ],
  },
  {
    key: 'HarbourWaterSafety',
    label: 'Marine (Harbour-Specific)',
    defaultRadioChannel: 4,
    subcategories: ['Vessel movement conflict — Harbour Master liaison', 'HM Coastguard called'],
  },
  {
    key: 'Licensing',
    label: 'Licensing & Compliance',
    defaultRadioChannel: 3,
    subcategories: [
      'Alcohol service refusal / Challenge 25 incident',
      'Licensing breach observation',
      'Noise complaint (neighbour notification territory)',
    ],
  },
  {
    key: 'VolunteerStaff',
    label: 'Volunteer / Staff',
    defaultRadioChannel: 3,
    subcategories: [
      'Volunteer/steward incorrect response requiring correction',
      'Staff injury',
      'Staff welfare concern',
    ],
  },
  {
    key: 'LostProperty',
    label: 'Lost Property',
    defaultRadioChannel: 3,
    subcategories: ['Lost item reported', 'Found item logged'],
  },
  {
    key: 'Other',
    label: 'Other',
    defaultRadioChannel: null,
    subcategories: [],
  },
];

export const RADIO_CHANNELS: Record<number, string> = {
  1: 'Ch1 — Traffic & Vehicle',
  2: 'Ch2 — Crowd & Site Ops',
  3: 'Ch3 — General Ops / Admin',
  4: 'Ch4 — Medical',
  5: 'Ch5 — EMERGENCY',
};

export function categoryLabel(key: CategoryKey | string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
