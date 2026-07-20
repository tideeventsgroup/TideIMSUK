import type { Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/send-escalation-push';
import webpush from 'web-push';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

webpush.setVapidDetails('mailto:ops@tideeventsgroup.co.uk', env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

type Handler = Schema['sendEscalationPush']['functionHandler'];

export const handler: Handler = async (event) => {
  const { incidentId, level, category, zone, narrative } = event.arguments;

  const { data: subscriptions } = await client.models.PushSubscription.list();

  const title = level === 'Level4' ? 'CRITICAL incident declared' : 'MAJOR incident declared';
  const body = `${category} — ${zone}. ${narrative.slice(0, 120)}`;
  const payload = JSON.stringify({ title, body, incidentId, level, url: `/incidents/${incidentId}` });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent += 1;
      } catch {
        // Expired/invalid subscription — drop it silently rather than fail the whole fan-out.
        try {
          await client.models.PushSubscription.delete({ id: sub.id });
        } catch {
          // best effort
        }
      }
    }),
  );

  return sent;
};
