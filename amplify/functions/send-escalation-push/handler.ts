import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import webpush from 'web-push';
import type { Schema } from '../../data/resource';

/**
 * Talks to DynamoDB directly (not the AppSync/GraphQL client) — reading
 * every subscription and deleting expired ones is simpler as a direct
 * table scan than routing through the API, and avoids needing a caller
 * identity for a Lambda that only ever runs server-side.
 */
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const PUSH_SUBSCRIPTION_TABLE = process.env.PUSH_SUBSCRIPTION_TABLE!;

webpush.setVapidDetails('mailto:ops@tideeventsgroup.co.uk', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

type Handler = Schema['sendEscalationPush']['functionHandler'];

async function scanAllSubscriptions(): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: PUSH_SUBSCRIPTION_TABLE, ExclusiveStartKey }));
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export const handler: Handler = async (event) => {
  const { incidentId, level, category, zone, narrative } = event.arguments;

  const subscriptions = await scanAllSubscriptions();

  const title = level === 'Level4' ? 'CRITICAL incident declared' : 'MAJOR incident declared';
  const body = `${category} — ${zone}. ${narrative.slice(0, 120)}`;
  const payload = JSON.stringify({ title, body, incidentId, level, url: `/incidents/${incidentId}` });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent += 1;
      } catch {
        // Expired/invalid subscription — drop it silently rather than fail the whole fan-out.
        try {
          await ddb.send(new DeleteCommand({ TableName: PUSH_SUBSCRIPTION_TABLE, Key: { id: sub.id } }));
        } catch {
          // best effort
        }
      }
    }),
  );

  return sent;
};
