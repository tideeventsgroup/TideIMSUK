import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Talks to DynamoDB directly (not the AppSync/GraphQL client) — this is a
 * scheduled background job with no caller identity, and `defineBackend`
 * grants it table-level IAM access via backend.ts rather than routing
 * through the API.
 */
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TEMPLATE_TABLE = process.env.CHECKLIST_TEMPLATE_TABLE!;
const INSTANCE_TABLE = process.env.CHECKLIST_INSTANCE_TABLE!;
const EVENT_TABLE = process.env.EVENT_TABLE!;

interface ScanFilter {
  expression: string;
  names?: Record<string, string>;
  values: Record<string, unknown>;
}

async function scanAll(tableName: string, filter?: ScanFilter): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
        ...(filter
          ? {
              FilterExpression: filter.expression,
              ExpressionAttributeNames: filter.names,
              ExpressionAttributeValues: filter.values,
            }
          : {}),
      }),
    );
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const handler = async () => {
  const today = todayISODate();

  const [templates, events] = await Promise.all([
    scanAll(TEMPLATE_TABLE, { expression: 'recurring = :r', values: { ':r': true } }),
    scanAll(EVENT_TABLE),
  ]);

  const activeEvents = events.filter((e) => e.startDate <= today && e.endDate >= today);
  if (templates.length === 0 || activeEvents.length === 0) {
    return { created: 0 };
  }

  let created = 0;
  const now = new Date().toISOString();

  for (const event of activeEvents) {
    const existingInstances = await scanAll(INSTANCE_TABLE, {
      expression: 'eventId = :e AND #d = :d',
      names: { '#d': 'date' },
      values: { ':e': event.id, ':d': today },
    });
    const existingTemplateIds = new Set(existingInstances.map((i) => i.templateId).filter(Boolean));

    for (const template of templates) {
      if (existingTemplateIds.has(template.id)) continue;

      const items = (template.items ?? []).map((item: { label: string; requiresPhoto: boolean; requiresSignoff: boolean }) => ({
        label: item.label,
        requiresPhoto: item.requiresPhoto,
        requiresSignoff: item.requiresSignoff,
        status: 'Pending',
      }));

      await ddb.send(
        new PutCommand({
          TableName: INSTANCE_TABLE,
          Item: {
            id: randomUUID(),
            __typename: 'ChecklistInstance',
            eventId: event.id,
            templateId: template.id,
            title: template.name,
            date: today,
            items,
            createdAt: now,
            updatedAt: now,
          },
        }),
      );
      created += 1;
    }
  }

  return { created };
};
