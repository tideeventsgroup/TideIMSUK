import { client } from '../data/client';

/**
 * Fans a Web Push notification out to every subscribed device — called
 * from every incident-logging action (new incident, status change, update
 * added, escalation declared). Best-effort: a failure here never blocks
 * the primary action, since the incident/update itself has already been
 * written by the time this runs.
 */
export async function pushNotify(title: string, body: string, url?: string, urgent = false, alarm = false) {
  try {
    await client.mutations.sendEscalationPush({ title, body, url, urgent, alarm });
  } catch {
    // best effort — device subscriptions/network issues shouldn't surface as user-facing errors
  }
}
