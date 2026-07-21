import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const EVENT_TABLE = process.env.EVENT_TABLE!;
const INCIDENT_TABLE = process.env.INCIDENT_TABLE!;

interface EventRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface IncidentRow {
  eventId: string;
  status: string;
  escalationLevel: string;
}

async function scanAll(tableName: string): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// Which event is "current" for the public page — no server-side "active
// event" flag exists (EventContext.tsx's choice is a per-device client
// preference), so this picks: live now, else nearest upcoming, else most
// recent past.
function pickCurrentEvent(events: EventRow[], today: string): EventRow | null {
  if (events.length === 0) return null;
  const live = events.find((e) => e.startDate <= today && e.endDate >= today);
  if (live) return live;
  const upcoming = events.filter((e) => e.startDate > today).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  if (upcoming.length > 0) return upcoming[0];
  const past = events.filter((e) => e.endDate < today).sort((a, b) => (a.endDate > b.endDate ? -1 : 1));
  return past[0] ?? null;
}

export const handler = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const events = (await scanAll(EVENT_TABLE)) as EventRow[];
  const current = pickCurrentEvent(events, today);

  if (!current) {
    return { eventName: null, status: 'Normal', message: 'No event scheduled.' };
  }

  const incidents = (await scanAll(INCIDENT_TABLE)) as IncidentRow[];
  const hasActiveAdvisory = incidents.some(
    (i) =>
      i.eventId === current.id &&
      i.status !== 'Resolved' &&
      (i.escalationLevel === 'Level3' || i.escalationLevel === 'Level4'),
  );

  return {
    eventName: current.name,
    status: hasActiveAdvisory ? 'Advisory' : 'Normal',
    message: hasActiveAdvisory
      ? 'An active advisory is in effect. Follow instructions from on-site staff and stewards.'
      : 'No active advisories. Event operating normally.',
  };
};
