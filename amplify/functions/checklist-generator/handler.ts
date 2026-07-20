import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/checklist-generator';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const handler = async () => {
  const today = todayISODate();

  const [{ data: templates }, { data: events }] = await Promise.all([
    client.models.ChecklistTemplate.list({ filter: { recurring: { eq: true } } }),
    client.models.Event.list(),
  ]);

  const activeEvents = events.filter((e) => e.startDate <= today && e.endDate >= today);
  if (templates.length === 0 || activeEvents.length === 0) {
    return { created: 0 };
  }

  let created = 0;

  for (const event of activeEvents) {
    const { data: existingInstances } = await client.models.ChecklistInstance.list({
      filter: { eventId: { eq: event.id }, date: { eq: today } },
    });
    const existingTemplateIds = new Set(existingInstances.map((i) => i.templateId).filter(Boolean));

    for (const template of templates) {
      if (existingTemplateIds.has(template.id)) continue;

      await client.models.ChecklistInstance.create({
        eventId: event.id,
        templateId: template.id,
        title: template.name,
        date: today,
        items: (template.items ?? []).map((item: { label: string; requiresPhoto: boolean; requiresSignoff: boolean } | null) => ({
          label: item!.label,
          requiresPhoto: item!.requiresPhoto,
          requiresSignoff: item!.requiresSignoff,
          status: 'Pending' as const,
        })),
      });
      created += 1;
    }
  }

  return { created };
};
