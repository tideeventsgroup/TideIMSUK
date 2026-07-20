import { client } from '../data/client';
import type { ChecklistTemplateItem } from '../types/checklist';

interface ChecklistTemplateSeedEntry {
  name: string;
  recurring: boolean;
  items: ChecklistTemplateItem[];
}

/**
 * Starting-point checklist templates for OSSP §18-19 sign-off requirements
 * (structural, electrical, fire, gas). Generic defaults — review against
 * the real OSSP text and your structural engineer/contractor sign-off
 * sheets before relying on these for a live event. Marked `recurring`
 * so the daily generator (amplify/functions/checklist-generator) creates
 * a fresh instance each operating day.
 */
export const CHECKLIST_TEMPLATE_SEED_DATA: ChecklistTemplateSeedEntry[] = [
  {
    name: 'Structural Sign-Off',
    recurring: true,
    items: [
      { label: 'Marquee/structure anchor points secure', requiresPhoto: true, requiresSignoff: true },
      { label: 'Ground surface/ballast check', requiresPhoto: false, requiresSignoff: true },
      { label: 'Wind rating certificate on site and current', requiresPhoto: true, requiresSignoff: true },
      { label: 'Structural engineer sign-off obtained (if required)', requiresPhoto: false, requiresSignoff: true },
      { label: 'Emergency evacuation route clear around structure', requiresPhoto: false, requiresSignoff: false },
    ],
  },
  {
    name: 'Electrical Certification',
    recurring: true,
    items: [
      { label: 'Generator condition and fuel check', requiresPhoto: true, requiresSignoff: true },
      { label: 'RCD/circuit protection tested', requiresPhoto: false, requiresSignoff: true },
      { label: 'Cable runs matted/covered, no trip hazards', requiresPhoto: true, requiresSignoff: false },
      { label: 'PAT certificates current for all connected equipment', requiresPhoto: false, requiresSignoff: true },
      { label: 'Qualified electrician sign-off obtained', requiresPhoto: false, requiresSignoff: true },
    ],
  },
  {
    name: 'Fire Safety Checks',
    recurring: true,
    items: [
      { label: 'Extinguishers present, in-date, and accessible', requiresPhoto: true, requiresSignoff: true },
      { label: 'Fire exits unobstructed and signed', requiresPhoto: true, requiresSignoff: false },
      { label: 'Catering/cooking equipment fire risk assessed', requiresPhoto: false, requiresSignoff: true },
      { label: 'Fire marshals briefed and assigned per zone', requiresPhoto: false, requiresSignoff: true },
      { label: 'Assembly point confirmed and communicated', requiresPhoto: false, requiresSignoff: false },
    ],
  },
  {
    name: 'Gas Safety Checks',
    recurring: true,
    items: [
      { label: 'Gas-safe registered engineer sign-off obtained', requiresPhoto: false, requiresSignoff: true },
      { label: 'Cylinders secured, upright, and ventilated', requiresPhoto: true, requiresSignoff: true },
      { label: 'Hoses/regulators inspected, no visible damage', requiresPhoto: true, requiresSignoff: false },
      { label: 'Emergency shut-off point known to catering staff', requiresPhoto: false, requiresSignoff: false },
    ],
  },
];

/** Idempotent: skips any template name that already exists. Returns the number created. */
export async function seedChecklistTemplates(): Promise<number> {
  const { data: existing } = await client.models.ChecklistTemplate.list();
  const existingNames = new Set(existing.map((t) => t.name));

  let created = 0;
  for (const entry of CHECKLIST_TEMPLATE_SEED_DATA) {
    if (existingNames.has(entry.name)) continue;
    await client.models.ChecklistTemplate.create({
      name: entry.name,
      recurring: entry.recurring,
      items: entry.items,
    });
    created += 1;
  }
  return created;
}
